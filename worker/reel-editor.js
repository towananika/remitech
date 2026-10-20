import * as R from '../reel-workflow.mjs';

const fail = (error, status = 400) => ({ error, status });
async function allWeeks(storage) {
  const weeks = new Map();
  for (const w of (await storage.list({prefix:'reel:week:'})).values()) weeks.set(w.start,w);
  return [...weeks.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
const isBooked = async (storage,date,pf) => !!(await storage.get(`bk:s:reel|${date}|${pf}|17:00`))?.scheduled;
const postOK = (p,pf) => p && typeof p.ja === 'string' && p.ja.trim() && p.ja.length <= 6000 && typeof p.en === 'string' && p.en.trim() && p.en.length <= (p.parts?.length?6000:pf==='X'?240:pf==='IG'?500:6000) && (!p.parts || (Array.isArray(p.parts)&&p.parts.length<=4&&p.parts.every(part=>postOK({ja:part.ja,en:part.en},pf))));
function prepared(p,date,pf){
  if(!Array.isArray(p.parts)||p.parts.length!==R.partLabels(date,pf).length)return null;
  const parts=p.parts.map((part,i)=>({label:R.partLabels(date,pf)[i],ja:typeof part.ja==='string'?part.ja.trim():'',en:typeof part.en==='string'?part.en.trim():''}));
  const out={ja:parts.map(p=>p.ja).join('\n\n'),en:parts.map(p=>p.en).join('\n\n'),parts,secondReview:null};
  return postOK(out,pf)?out:null;
}
// Prepared manuscripts stay in private KV; import only missing posts into shared storage.
const PREPARED_KEY = 'reel:prepared:2026-10-27-11-01:v1';
async function importPrepared(hub) {
  const storage=hub.ctx.storage;
  if(await storage.get(PREPARED_KEY))return;
  const source=await hub.env.CHORES.get(PREPARED_KEY,'json');
  if(!source || source.version!==1)return;
  if(!Array.isArray(source.weeks)||source.weeks.length>8)throw new Error('prepared-weeks');
  const weeks=source.weeks.map(w=>{
    if(!R.dateOK(w.start)||R.monday(w.start)!==w.start||typeof w.theme!=='string'||!w.theme.trim()||typeof w.arc!=='string'||!w.arc.trim()||!Array.isArray(w.days))throw new Error('prepared-week');
    const dates=new Set();
    const days=w.days.map(d=>{
      if(!R.dateOK(d.date)||d.date<'2026-10-27'||d.date>R.EDITOR_END_DATE||R.monday(d.date)!==w.start||dates.has(d.date))throw new Error('prepared-date');
      dates.add(d.date);
      const posts={};
      for(const [pf,p] of Object.entries(d.posts||{})){
        if(!['X','IG'].includes(pf))throw new Error('prepared-platform');
        const content=prepared(p,d.date,pf);if(!content)throw new Error('prepared-structure');
        posts[pf]=content;
      }
      return {date:d.date,focus:typeof d.focus==='string'?d.focus:w.theme,posts};
    });
    return {start:w.start,theme:w.theme,themeId:'prepared-'+w.start,angle:w.arc,arc:w.arc,revision:0,days};
  });
  await storage.transaction(async tx=>{
    if(await tx.get(PREPARED_KEY))return;
    for(const sourceWeek of weeks){
      const key='reel:week:'+sourceWeek.start;
      const w=await tx.get(key)||{...sourceWeek,days:[]};let changed=false;
      for(const incoming of sourceWeek.days){
        let day=w.days.find(d=>d.date===incoming.date);
        if(!day){day={...incoming,posts:{}};w.days.push(day);}
        for(const [pf,p] of Object.entries(incoming.posts)){
          if(!day.posts[pf] && !await isBooked(tx,day.date,pf)){day.posts[pf]=p;changed=true;}
        }
      }
      if(changed){w.days.sort((a,b)=>a.date.localeCompare(b.date));w.revision++;w.updatedAt=new Date().toISOString();w.updatedBy='prepared-import';await tx.put(key,w);}
    }
    await tx.put(PREPARED_KEY,{importedAt:new Date().toISOString()});
  });
  hub.broadcast('reel');
}
export async function editor(hub, request, origin, respond) {
  const send = (body,status=200) => respond(body,status,origin,{'Cache-Control':'no-store'});
  const session=await hub.session(request);
  if(!session)return send({error:'member-required'},401);
  if(!(session.user.member || hub.isAdmin(session.user.id)))return send({error:'member-required'},403);
  await importPrepared(hub);
  const read=storage=>allWeeks(storage);
  const getWeek=async (storage,start)=>await storage.get('reel:week:'+start);
  const settings = async () => await hub.ctx.storage.get('reel:settings') || {brief:R.DEFAULT_BRIEF};
  if (request.method==='GET') return send({weeks:await read(hub.ctx.storage),settings:await settings(),timezone:R.TIMEZONE,ai:false});
  if (request.method!=='POST') return send({error:'method'},405);
  if (origin && !['https://towananika.github.io','http://localhost:8899','http://127.0.0.1:8899'].includes(origin)) return send({error:'origin'},403);
  const raw=await request.text();if(raw.length>200000)return send({error:'too-large'},413);
  let b;try{b=JSON.parse(raw);}catch{return send({error:'bad-json'},400);}
  if(!b || typeof b!=='object')return send({error:'bad-json'},400);
  const actor=session.user.id;
  if(b.op==='settings'){
    if(typeof b.brief!=='string' || b.brief.trim().length<10 || b.brief.length>3000)return send({error:'brief'},400);
    await hub.ctx.storage.put('reel:settings',{brief:b.brief.trim()});hub.broadcast('reel');return send({ok:true,settings:await settings()});
  }
  if(!R.dateOK(b.start) || R.monday(b.start)!==b.start)return send({error:'week'},400);
  try{
    if(b.op==='draft'){
      if(!R.dateOK(b.date)||b.date>R.EDITOR_END_DATE||R.monday(b.date)!==b.start||!['X','IG'].includes(b.platform))return send({error:'draft'},400);
      const content=prepared(b,b.date,b.platform);if(!content)return send({error:'structure'},400);
      const result=await hub.ctx.storage.transaction(async tx=>{
        let w=await getWeek(tx,b.start);
        if((w?.revision||0)!==b.revision)return fail('conflict',409);
        if(!w){
          if(typeof b.theme!=='string'||!b.theme.trim()||b.theme.length>120||typeof b.arc!=='string'||!b.arc.trim()||b.arc.length>600)return fail('theme');
          const theme=b.theme.trim();
          const old=(await read(tx)).find(other=>R.normalized(other.theme)===R.normalized(theme)&&Math.abs(Date.parse(other.start)-Date.parse(b.start))<28*86400000);
          if(old)return fail('theme-overlap');
          w={start:b.start,theme,themeId:'manual-'+b.start,angle:b.arc.trim(),arc:b.arc.trim(),revision:0,days:[]};
        }
        let day=w.days.find(d=>d.date===b.date);
        if(day?.posts[b.platform])return fail('conflict',409);
        if(!day){day={date:b.date,focus:w.theme,posts:{}};w.days.push(day);w.days.sort((a,b)=>a.date.localeCompare(b.date));}
        day.posts[b.platform]=content;
        w.revision++;w.updatedAt=new Date().toISOString();w.updatedBy=actor;
        await tx.put('reel:week:'+w.start,w);return{ok:true,week:w};
      });
      if(result.error)return send({error:result.error},result.status);
      hub.broadcast('reel');return send(result);
    }
    const initial=await getWeek(hub.ctx.storage,b.start);
    const initialDay=initial?.days.find(d=>d.date===b.date);
    if(!initial || !initialDay)return send({error:'not-found'},404);
    if(!['X','IG'].includes(b.platform))return send({error:'platform'},400);
    if(b.revision!==initial.revision)return send({error:'conflict'},409);
    const result=await hub.ctx.storage.transaction(async tx=>{
      const w=await getWeek(tx,b.start);
      if(w.revision!==b.revision)return fail('conflict',409);
      let day=w.days.find(d=>d.date===b.date);
      let p=day.posts[b.platform];
      if(b.op==='edit'){
        const next=b.parts?prepared(b,b.date,b.platform):b;if(!next||!postOK(next,b.platform)||p?.parts&&!b.parts)return fail('draft');
        if(await isBooked(tx,b.date,b.platform))return fail('already-booked',409);
        const texts=new Set((await read(tx)).flatMap(w=>w.days.filter(d=>d.date!==b.date).map(d=>R.normalized(R.english(d.posts[b.platform])))));
        if(texts.has(R.normalized(next.en)))return fail('duplicate-text');
        p={ja:next.ja.trim(),en:next.en.trim(),secondReview:null};
        if(next.parts)p.parts=next.parts;
        day.posts[b.platform]=p;
      }else if(b.op==='review2' || b.op==='nobo-edit' || b.op==='nobo-reset'){
        if(!p)return fail('draft');
        if(b.op==='nobo-edit'){
          if(await isBooked(tx,b.date,b.platform))return fail('already-booked',409);
          if(typeof b.en!=='string' || !b.en.trim() || b.en.length>(p.parts?.length?6000:b.platform==='X'?240:500))return fail('draft');
          if(p.parts?.length){
            if(!Array.isArray(b.parts) || b.parts.length!==p.parts.length || b.parts.some(s=>typeof s!=='string'||!s.trim()||s.length>(b.platform==='X'?240:500)))return fail('draft');
            p.noboParts=b.parts.map(s=>s.trim());p.noboEn=p.noboParts.join('\n\n');
            if(p.noboEn.length>6000)return fail('draft');
          }else p.noboEn=b.en.trim();
          delete p.imagePrompt;
          p.secondReview={by:actor,at:new Date().toISOString(),kind:'corrected'};
        }else if(b.op==='nobo-reset'){
          if(await isBooked(tx,b.date,b.platform))return fail('already-booked',409);
          delete p.noboEn;delete p.noboParts;delete p.imagePrompt;p.secondReview=null;
        }else{
          p.secondReview=p.secondReview?null:{by:actor,at:new Date().toISOString(),kind:p.noboEn?'corrected':'unchanged'};
        }
      }else if(b.op==='book'){
        if(!p || typeof b.scheduled!=='boolean')return fail('draft');
        if(b.scheduled && !R.ready({...p,date:day.date}))return fail('not-ready',409);
        const sk=`reel|${day.date}|${b.platform}|17:00`,prev=await tx.get('bk:s:'+sk)||{};
        await tx.put('bk:s:'+sk,{...prev,scheduled:b.scheduled,skip:false,status:b.scheduled?'':'preparing'});
        const sl=await tx.get('bk:n:'+sk)||{date:day.date,channel:'reel',platform:b.platform,time:'17:00',label:b.platform==='IG'?'IG フィード':'X スレッド',type:'text',need:['text'],posted:false,url:'',check:{done:false,at:'',match:null,note:''},note:'投稿タブから作成'};
        // /book is public. Share marks and slot coordinates, never employee drafts.
        sl.text={ja:'',en:'',ko:''};sl.scheduled=b.scheduled;delete sl.parts;
        await tx.put('bk:n:'+sk,sl);
      }else return fail('op');
      w.revision++;w.updatedAt=new Date().toISOString();w.updatedBy=actor;
      await tx.put('reel:week:'+w.start,w);
      return{ok:true,week:w,...(b.op==='image'?{prompt:p.imagePrompt}:{})};
    });
    if(result.error)return send({error:result.error},result.status);
    hub.broadcast('reel');if(b.op==='book')hub.broadcast('book');return send(result);
  }catch{return send({error:'storage'},500);}
}

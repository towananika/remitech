import * as R from '../reel-workflow.mjs';

const fail = (error, status = 400) => ({ error, status });
const parseAI = result => {
  const raw = result && result.response;
  return typeof raw === 'string' ? JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()) : raw;
};
async function allWeeks(storage) {
  const weeks = new Map();
  for (const w of (await storage.list({prefix:'reel:week:'})).values()) weeks.set(w.start,w);
  return [...weeks.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
const isBooked = async (storage,date,pf) => !!(await storage.get(`bk:s:reel|${date}|${pf}|17:00`))?.scheduled;
const postOK = (p,pf) => p && typeof p.ja === 'string' && p.ja.trim() && p.ja.length <= 6000 && typeof p.en === 'string' && p.en.trim() && p.en.length <= (pf==='X'?240:pf==='IG'?500:6000);
export async function editor(hub, request, origin, respond) {
  const send = (body,status=200) => respond(body,status,origin,{'Cache-Control':'no-store'});
  const session=await hub.session(request);
  if(!session)return send({error:'member-required'},401);
  if(!(session.user.member || hub.isAdmin(session.user.id)))return send({error:'member-required'},403);
  const read=storage=>allWeeks(storage);
  const getWeek=async (storage,start)=>await storage.get('reel:week:'+start);
  const settings = async () => await hub.ctx.storage.get('reel:settings') || {brief:R.DEFAULT_BRIEF};
  if (request.method==='GET') return send({weeks:await read(hub.ctx.storage),settings:await settings(),timezone:R.TIMEZONE,ai:!!hub.env.AI});
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
  if(['review2','nobo-edit'].includes(b.op) && !String(hub.env.REEL_SECONDARY_IDS || 'nobo').toLowerCase().split(',').map(s=>s.trim()).includes(actor))return send({error:'reviewer'},403);
  if(!R.dateOK(b.start) || R.monday(b.start)!==b.start)return send({error:'week'},400);
  const aiOp=['generate','regenerate','image'].includes(b.op);
  if(aiOp && !hub.env.AI)return send({error:'ai-unavailable'},503);
  let lease;
  if(aiOp){
    lease=crypto.randomUUID();
    const taken=await hub.ctx.storage.transaction(async tx=>{
      const cur=await tx.get('reel:ai-lock');if(cur && cur.until>Date.now())return false;
      await tx.put('reel:ai-lock',{id:lease,until:Date.now()+600000});return true;
    });
    if(!taken)return send({error:'ai-busy'},429);
  }
  try{
    let weeks=await read(hub.ctx.storage);
    if(b.op==='generate'){
      // Four distinct weeks are planned together. Existing drafts are never overwritten.
      const starts=Array.from({length:4},(_,i)=>R.addDays(b.start,i*7)).filter(start=>!weeks.some(w=>w.start===start));
      if(!starts.length)return send({ok:true,weeks});
      const candidates=[];
      for(const start of starts){
        const context=weeks.concat(candidates);
        const out=parseAI(await hub.env.AI.run(R.MODEL,{messages:[{role:'system',content:'Return valid JSON only. Follow the specified week dates exactly.'},{role:'user',content:R.prompt(start,context,(await settings()).brief,1)}],max_tokens:6000}));
        const w=out && out.weeks && out.weeks[0];
        if(!out || out.weeks.length!==1 || !w || w.start!==start || R.validateWeek(w,context))return send({error:'generation-failed'},502);
        candidates.push(R.cleanWeek(w));
      }
      const saved=await hub.ctx.storage.transaction(async tx=>{
        const latest=await read(tx);
        if(candidates.some(w=>latest.some(old=>old.start===w.start) || R.validateWeek(w,latest.concat(candidates.filter(c=>c!==w)))))return false;
        for(const w of candidates)await tx.put('reel:week:'+w.start,{...w,revision:1,updatedAt:new Date().toISOString(),updatedBy:actor});
        return true;
      });
      if(!saved)return send({error:'conflict'},409);
      hub.broadcast('reel');return send({ok:true,weeks:await read(hub.ctx.storage)});
    }
    const initial=await getWeek(hub.ctx.storage,b.start);
    const initialDay=initial?.days.find(d=>d.date===b.date) || (b.op==='regenerate' && R.dateOK(b.date) && R.monday(b.date)===b.start ? {date:b.date,focus:initial?.theme,posts:{}} : null);
    if(!initial || !initialDay)return send({error:'not-found'},404);
    if(!['X','IG'].includes(b.platform))return send({error:'platform'},400);
    if(b.revision!==initial.revision)return send({error:'conflict'},409);
    let generated;
    if(b.op==='regenerate' || b.op==='image'){
      if(b.op==='regenerate' && await isBooked(hub.ctx.storage,b.date,b.platform))return send({error:'already-booked'},409);
      const p=initialDay.posts[b.platform];
      if(b.op==='image' && !p)return send({error:'draft'},400);
      const brief=(await settings()).brief;
      const instruction=b.op==='image'
        ? `Create one detailed English image-generation prompt suitable for this ${b.platform} post. Match its meaning and REEL's brand. Specify composition, lighting, mood, a single clear visual metaphor and a 4:5 composition. No visible text, no logos, no invented claims. Return JSON {"prompt":"..."} only. Post: ${JSON.stringify({ja:p.ja,en:R.english(p)})}`
        : `REELの${b.platform}用の日英草案を作成。週テーマ「${initial.theme}」、切り口「${initial.angle}」、週の流れ「${initial.arc}」。日付${b.date}の役割「${initialDay.focus}」を守り、他の日と同じ文章にしない。短い単独投稿で、英文は${b.platform==='X'?240:500}文字以内。IGは画像用キャプション。明確な冒頭と役立つ気づきを優先し、自然な質問は必要な場合だけ。反応稼ぎの呼びかけは禁止。架空の数値・実績・未確認の製品機能を断定しない。修正指示: ${String(b.instructions||'新しい切り口で不自然な内容を修正').slice(0,2000)}。元の草案（未作成なら新規作成）: ${JSON.stringify(p||{})}。同じ週の他の日: ${JSON.stringify(initial.days.filter(d=>d.date!==b.date).map(d=>({date:d.date,focus:d.focus,post:d.posts[b.platform]})))}。JSONのみ {"ja":"...","en":"..."}。`;
      generated=parseAI(await hub.env.AI.run(R.MODEL,{messages:[{role:'system',content:'You are a bilingual Japanese/English social media editor. Return valid JSON only.'},{role:'user',content:`Brand: ${brief}\n${instruction}`}],max_tokens:b.op==='image'?1000:3000}));
      if(b.op==='image'){
        if(typeof generated?.prompt!=='string' || !generated.prompt.trim() || generated.prompt.length>6000)return send({error:'generation-failed'},502);
      }else if(!postOK(generated,b.platform))return send({error:'generation-failed'},502);
    }
    const result=await hub.ctx.storage.transaction(async tx=>{
      const w=await getWeek(tx,b.start);
      if(w.revision!==b.revision)return fail('conflict',409);
      let day=w.days.find(d=>d.date===b.date);
      if(!day && b.op==='regenerate'){day=structuredClone(initialDay);w.days.push(day);w.days.sort((a,b)=>a.date.localeCompare(b.date));}
      let p=day.posts[b.platform];
      if(b.op==='edit' || b.op==='regenerate'){
        const next=b.op==='edit'?b:generated;if(!postOK(next,b.platform))return fail('draft');
        if(await isBooked(tx,b.date,b.platform))return fail('already-booked',409);
        const texts=new Set((await read(tx)).flatMap(w=>w.days.filter(d=>d.date!==b.date).map(d=>R.normalized(R.english(d.posts[b.platform])))));
        if(texts.has(R.normalized(next.en)))return fail('duplicate-text');
        p={ja:next.ja.trim(),en:next.en.trim(),secondReview:null};
        if(b.op==='regenerate' && Array.isArray(next.parts) && next.parts.length){
          if(next.parts.length>10 || next.parts.some(part=>!postOK(part)))return fail('generation-failed',502);
          p.parts=next.parts.map((part,i)=>({label:String(part.label||`Part ${i+1}`).slice(0,30),ja:part.ja,en:part.en}));
          p.ja=p.parts.map(part=>part.ja).join('\n\n');p.en=p.parts.map(part=>part.en).join('\n\n');
        }
        day.posts[b.platform]=p;
    }else if(b.op==='image'){
        p.imagePrompt=generated.prompt.trim();
      }else if(b.op==='review2' || b.op==='nobo-edit'){
        if(!p)return fail('draft');
        if(b.op==='nobo-edit'){
          if(await isBooked(tx,b.date,b.platform))return fail('already-booked',409);
          if(typeof b.en!=='string' || !b.en.trim() || b.en.length>(b.platform==='X'?240:500))return fail('draft');
          if(p.parts?.length){
            if(!Array.isArray(b.parts) || b.parts.length!==p.parts.length || b.parts.some(s=>typeof s!=='string'||!s.trim()||s.length>6000))return fail('draft');
            p.noboParts=b.parts.map(s=>s.trim());p.noboEn=p.noboParts.join('\n\n');
            if(p.noboEn.length>6000)return fail('draft');
          }else p.noboEn=b.en.trim();
          delete p.imagePrompt;
        }else{if(p.noboEn && await isBooked(tx,b.date,b.platform))return fail('already-booked',409);delete p.noboEn;delete p.noboParts;delete p.imagePrompt;}
        p.secondReview={by:actor,at:new Date().toISOString(),kind:b.op==='nobo-edit'?'corrected':'unchanged'};
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
  }catch{return send({error:aiOp?'generation-failed':'storage'},aiOp?502:500);}
  finally{
    if(lease)await hub.ctx.storage.transaction(async tx=>{if((await tx.get('reel:ai-lock'))?.id===lease)await tx.delete('reel:ai-lock');});
  }
}

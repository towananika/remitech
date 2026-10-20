import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../reel-workflow.mjs';
import {editor} from '../worker/reel-editor.js';

function week(start='2026-11-02',themeId='theme-'+start){
  return {start,themeId,theme:'Theme '+themeId,angle:'Angle '+start,arc:'Introduction, detail, example, practice and reflection',revision:1,
    days:Array.from({length:7},(_,i)=>({date:R.addDays(start,i),focus:'Day '+i,posts:Object.fromEntries(['X','IG'].map(pf=>[pf,{ja:`日本語 ${start} ${i} ${pf}`,en:`English ${start} ${i} ${pf}`,secondReview:null}]))}))};
}
class Store{
  constructor(map=new Map()){this.map=map;this.queue=Promise.resolve();}
  async get(k){return structuredClone(this.map.get(k));}
  async put(k,v){this.map.set(k,structuredClone(v));}
  async delete(k){this.map.delete(k);}
  async list({prefix}){return new Map([...this.map].filter(([k])=>k.startsWith(prefix)).map(([k,v])=>[k,structuredClone(v)]));}
  transaction(fn){const run=this.queue.then(async()=>{const tx=new Store(structuredClone(this.map));const result=await fn(tx);this.map=tx.map;return result;});this.queue=run.catch(()=>{});return run;}
}
function context({user={id:'hibiki',member:true},seed=[],ai}={}){
  const storage=new Store();const broadcasts=[];
  for(const w of seed)storage.map.set('reel:week:'+w.start,structuredClone(w));
  const hub={ctx:{storage},env:{CHORES:{get:async()=>({weeks:seed,brief:'A real brand brief with explicit constraints'})},...(ai?{AI:{run:ai}}:{})},
    session:async()=>user?{user}:null,isAdmin:id=>id==='admin',broadcast:t=>broadcasts.push(t)};
  const request=async(body,customUser)=>{
    if(customUser!==undefined)hub.session=async()=>customUser?{user:customUser}:null;
    const req=new Request('http://127.0.0.1:8787/editor',{method:body?'POST':'GET',headers:{Origin:'http://127.0.0.1:8899'},body:body?JSON.stringify(body):undefined});
    const r=await editor(hub,req,'http://127.0.0.1:8899',(j,status)=>new Response(JSON.stringify(j),{status}));return{status:r.status,...await r.json()};
  };return{hub,storage,request,broadcasts};
}
const action=(op,w,extra={})=>({op,start:w.start,date:w.days[0].date,platform:'X',revision:w.revision,...extra});

test('Seoul deadline crosses at midnight and NOBO completion releases early',()=>{
  const p={date:'2026-11-03',ja:'草案',en:'Draft'};
  assert.equal(R.ready(p,new Date('2026-11-01T14:59:59Z')),false);
  assert.equal(R.ready(p,new Date('2026-11-01T15:00:00Z')),true);
  assert.equal(R.ready({...p,secondReview:{kind:'unchanged'}},new Date('2026-10-20T00:00:00Z')),true);
  assert.equal(R.monday('2026-11-01'),'2026-10-26');
  assert.equal(R.dateOK('2026-02-30'),false);
});
test('four-week uniqueness and fresh angles/text on later reuse',()=>{
  const a=week(),b=week('2026-11-23',a.themeId);
  assert.equal(R.validateWeek(b,[a]),'theme-overlap');
  const c=week('2026-11-30',a.themeId);assert.equal(R.validateWeek(c,[a]),'');
  c.angle=a.angle;assert.equal(R.validateWeek(c,[a]),'angle-reused');
  c.angle='New angle';c.days[0].posts.X.en=a.days[0].posts.X.en;
  assert.equal(R.validateWeek(c,[a]),'duplicate-text');
  const d=week('2026-12-07');d.days[1].date=d.days[0].date;assert.equal(R.validateWeek(d),'draft');
});
test('employee-only reads and writes, including direct endpoint access',async()=>{
  const c=context({seed:[week()]});
  assert.equal((await c.request(null,null)).status,401);
  assert.equal((await c.request(null,{id:'guest',member:false})).status,403);
  assert.equal((await c.request(null,{id:'admin',member:false})).weeks.length,1);
});
test('NOBO unchanged uses original; correction preserves original and supplies corrected copies',async()=>{
  let w=week();const c=context({seed:[w],user:{id:'nobo',member:true}});
  let r=await c.request(action('review2',w));assert.equal(r.status,200);w=r.week;
  assert.equal(R.english(w.days[0].posts.X),w.days[0].posts.X.en);
  const original=w.days[0].posts.X.en;
  r=await c.request(action('nobo-edit',w,{en:'Corrected English'}));assert.equal(r.status,200);w=r.week;
  assert.equal(w.days[0].posts.X.en,original);assert.equal(R.english(w.days[0].posts.X),'Corrected English');
  assert.equal(w.days[0].posts.X.secondReview.kind,'corrected');
  r=await c.request(action('edit',w,{ja:'修正済みの日本語',en:'New authored English'}));assert.equal(r.status,200);
  assert.equal(r.week.days[0].posts.X.secondReview,null);assert.equal(r.week.days[0].posts.X.noboEn,undefined);
});
test('NOBO thread corrections keep part boundaries and original copy',async()=>{
  let w=week();const p=w.days[0].posts.X;p.parts=[{label:'Thread1',ja:'一',en:'One'},{label:'Reply',ja:'二',en:'Two'}];
  const c=context({seed:[w],user:{id:'nobo',member:true}});
  const r=await c.request(action('nobo-edit',w,{en:'One fixed\n\nTwo fixed',parts:['One fixed','Two fixed']}));
  assert.equal(r.status,200);const saved=r.week.days[0].posts.X;
  assert.equal(saved.parts[0].en,'One');assert.equal(R.englishPart(saved,1),'Two fixed');
});
test('employees can review while general members cannot; stale revisions do not overwrite',async()=>{
  const w=week(),c=context({seed:[w]});assert.equal((await c.request(action('review2',w),{id:'guest',member:false})).status,403);await c.request(null,{id:'hibiki',member:true});
  let r=await c.request(action('edit',w,{ja:'修正',en:'Edited'}));assert.equal(r.status,200);
  r=await c.request(action('edit',w,{ja:'古い編集',en:'Stale'}));assert.equal(r.status,409);
});
test('booking uses the existing slot key, keeps public /book free of draft text and blocks text changes',async()=>{
  const w=week('2026-10-05'),c=context({seed:[w]});
  let r=await c.request(action('book',w,{scheduled:true}));assert.equal(r.status,200);
  assert.equal((await c.storage.get('bk:s:reel|2026-10-05|X|17:00')).scheduled,true);
  const slot=await c.storage.get('bk:n:reel|2026-10-05|X|17:00');assert.deepEqual(slot.text,{ja:'',en:'',ko:''});
  assert.equal((await c.request(action('edit',r.week,{ja:'変更',en:'Changed'}))).status,409);
  r=await c.request(action('book',r.week,{scheduled:false}));assert.equal(r.status,200);
  assert.equal((await c.request(action('edit',r.week,{ja:'変更',en:'Changed'}))).status,200);
});
test('prepared text creates a week without AI and never overwrites an existing post',async()=>{
  const c=context();
  const body={op:'draft',start:'2026-10-26',date:'2026-10-27',platform:'X',revision:0,theme:'Player discoveries',arc:'Notice, share, reflect',ja:'遊んだ人の気づき',en:'A discovery from real play.'};
  body.parts=R.partLabels(body.date,'X').map((label,i)=>({label,ja:body.ja+i,en:body.en+i}));const r=await c.request(body);assert.equal(r.status,200);assert.equal(r.week.days[0].posts.X.parts[0].en,body.en+'0');
  assert.equal(r.week.days[0].posts.X.secondReview,null);
  assert.equal((await c.request({...body,revision:r.week.revision})).status,409);
});
test('manual drafts add IG independently and reject overlapping week themes',async()=>{
  const c=context();const body={op:'draft',start:'2026-10-26',date:'2026-10-27',platform:'X',revision:0,theme:'Player discoveries',arc:'Notice, share, reflect',ja:'気づき',en:'A discovery.'};
  body.parts=R.partLabels(body.date,'X').map((label,i)=>({label,ja:body.ja+i,en:body.en+i}));const first=await c.request(body);
  const ig=await c.request({...body,platform:'IG',revision:first.week.revision,en:'A separate IG caption.',parts:[{ja:'IG本文',en:'IG caption'},{ja:'コメント',en:'Your thought?'}]});assert.equal(ig.status,200);assert.equal(ig.week.days[0].posts.X.parts[0].en,'A discovery.0');
  const past=week('2026-10-19');past.theme=body.theme;await c.storage.put('reel:week:'+past.start,past);const clash=await c.request({...body,date:'2026-10-28',revision:0,start:'2026-10-26'});assert.equal(clash.status,409);
  const future=await c.request({...body,start:'2026-11-02',date:'2026-11-03'});assert.equal(future.status,400);
});

test('weekday/weekend structures match each channel and non-staff cannot edit',async()=>{
  assert.deepEqual(R.partLabels('2026-10-27','X'),['Feed 1','Feed 2','Feed 3','Comment']);
  assert.deepEqual(R.partLabels('2026-10-27','IG'),['Feed 1','Comment']);
  assert.deepEqual(R.partLabels('2026-10-31','X'),['Feed 1']);
  assert.deepEqual(R.partLabels('2026-11-01','IG'),['Feed 1']);
  const w=week(),c=context({seed:[w]});
  assert.equal((await c.request(action('nobo-edit',w,{en:'No access'}),{id:'guest',member:false})).status,403);
  const r=await c.request(action('nobo-edit',w,{en:'Employee revision'}),{id:'editor',member:true});assert.equal(r.status,200);assert.equal(r.week.days[0].posts.X.noboEn,'Employee revision');
});


test('private prepared manuscripts import once for employees and preserve existing edits',async()=>{
  const start='2026-10-26',date='2026-10-27';
  const source={version:1,weeks:[{start,theme:'Records and trust',arc:'Address, connection, trust',days:[{date,posts:Object.fromEntries(['X','IG'].map(pf=>[pf,{parts:R.partLabels(date,pf).map(label=>({label,ja:'日本語 '+label,en:'English '+label}))}]))}]}]};
  const existing={start,theme:'Existing theme',arc:'Existing arc',revision:4,days:[{date,posts:{X:{ja:'既存',en:'Existing original',noboEn:'NOBO correction',secondReview:{by:'nobo'}}}}]};
  const c=context({seed:[existing]});let reads=0;
  c.hub.env.CHORES.get=async key=>{reads++;return source;};
  assert.equal((await c.request(null,null)).status,401);assert.equal(reads,0);
  assert.equal((await c.request(null,{id:'guest',member:false})).status,403);assert.equal(reads,0);
  let r=await c.request(null,{id:'hibiki',member:true});assert.equal(r.status,200);
  assert.equal(r.weeks[0].days[0].posts.X.noboEn,'NOBO correction');
  assert.equal(r.weeks[0].days[0].posts.IG.parts.length,2);
  assert.equal(r.weeks[0].days[0].posts.IG.secondReview,null);
  assert.equal(r.weeks[0].revision,5);
  r=await c.request(null,{id:'nobo',member:true});assert.equal(r.weeks[0].days[0].posts.IG.parts.length,2);assert.equal(reads,1);
});
test('malformed prepared manuscripts never partially import',async()=>{
  const c=context();c.hub.env.CHORES.get=async()=>({version:1,weeks:[{start:'2026-10-26',theme:'Theme',arc:'Arc',days:[{date:'2026-11-02',posts:{}}]}]});
  await assert.rejects(c.request(),/prepared-date/);
  assert.equal((await c.storage.list({prefix:'reel:week:'})).size,0);
});

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
test('other employees cannot record NOBO checks; stale revisions do not overwrite',async()=>{
  const w=week(),c=context({seed:[w]});assert.equal((await c.request(action('review2',w))).status,403);
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
test('AI creates four distinct weeks atomically; repeat opening preserves existing drafts',async()=>{
  let calls=0;const c=context({ai:async(model,input)=>{
    assert.equal(model,R.MODEL);const start=input.messages[1].content.match(/月曜 (\d{4}-\d{2}-\d{2})/)[1];calls++;return{response:JSON.stringify({weeks:[week(start)]})};
  }});
  let r=await c.request({op:'generate',start:'2026-11-02'});assert.equal(r.status,200);assert.equal(r.weeks.length,4);assert.equal(calls,4);
  r=await c.request({op:'generate',start:'2026-11-02'});assert.equal(r.status,200);assert.equal(calls,4);
});
test('invalid AI output saves nothing and releases generation lease',async()=>{
  const c=context({ai:async()=>({response:'not JSON'})});const r=await c.request({op:'generate',start:'2026-11-02'});
  assert.equal(r.status,502);assert.equal((await c.storage.list({prefix:'reel:week:'})).size,0);assert.equal(await c.storage.get('reel:ai-lock'),undefined);
});
test('regeneration clears check/image; image generation stores no visible text field',async()=>{
  let w=week();w.days[0].posts.X.secondReview={by:'nobo'};w.days[0].posts.X.imagePrompt='old';
  let image=false;const c=context({seed:[w],ai:async()=>({response:JSON.stringify(image?{prompt:'A fresh image prompt'}:{ja:'再生成した草案',en:'A regenerated draft'})})});
  let r=await c.request(action('regenerate',w));assert.equal(r.status,200);w=r.week;
  assert.equal(w.days[0].posts.X.secondReview,null);assert.equal(w.days[0].posts.X.imagePrompt,undefined);
  image=true;r=await c.request(action('image',w));assert.equal(r.prompt,'A fresh image prompt');
  assert.equal(r.week.days[0].posts.X.en,'A regenerated draft');
});

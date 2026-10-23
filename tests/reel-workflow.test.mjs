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
function context({user={id:'admin',member:true},seed=[],ai}={}){
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

test('drafts can be copied before NOBO review regardless of posting date',()=>{
  const p={date:'2026-11-03',ja:'草案',en:'Draft'};
  assert.equal(R.ready(p,new Date('2026-11-01T14:59:59Z')),true);
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
test('general members cannot write and stale revisions do not overwrite',async()=>{
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
  const future=await c.request({...body,start:'2026-11-30',date:'2026-12-01'});assert.equal(future.status,400);
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
  c.hub.env.CHORES.get=async key=>{if(key!=='reel:prepared:2026-10-27-11-01:v1')return null;reads++;return source;};
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


test('review toggles off without discarding corrections and reset restores all original parts',async()=>{
  let w=week('2026-10-26');const d=w.days[0],p=d.posts.X;
  p.parts=[{label:'Feed 1',ja:'一',en:'Original one'},{label:'Feed 2',ja:'二',en:'Original two'}];
  const c=context({seed:[w]});
  let r=await c.request(action('nobo-edit',w,{en:'Fixed one\n\nFixed two',parts:['Fixed one','Fixed two']}));w=r.week;
  r=await c.request(action('review2',w));w=r.week;
  assert.equal(w.days[0].posts.X.secondReview,null);assert.equal(R.englishPart(w.days[0].posts.X,0),'Fixed one');
  r=await c.request(action('review2',w));w=r.week;assert.equal(w.days[0].posts.X.secondReview.kind,'corrected');
  const stale=w.revision;
  r=await c.request(action('nobo-reset',w));w=r.week;assert.equal(r.status,200);
  assert.equal(w.days[0].posts.X.secondReview,null);assert.equal(w.days[0].posts.X.noboEn,undefined);
  assert.equal(w.days[0].posts.X.noboParts,undefined);assert.equal(R.englishPart(w.days[0].posts.X,0),'Original one');
  assert.equal((await c.request(action('nobo-reset',w,{revision:stale}))).status,409);
  r=await c.request(action('book',w,{scheduled:true}));assert.equal(r.status,200);
  assert.equal((await c.request(action('nobo-reset',r.week))).status,409);
  assert.equal((await c.request(action('nobo-reset',r.week),{id:'guest',member:false})).status,403);
});


test('each feed confirms independently and scoped edits/reset preserve all other feeds',async()=>{
  let w=week('2026-10-26');const p=w.days[0].posts.X;
  p.parts=R.partLabels(w.days[0].date,'X').map((label,i)=>({label,ja:'日本語'+i,en:'Original '+i}));
  const c=context({seed:[w]});
  for(let i=0;i<4;i++){
    const r=await c.request(action('confirm-part',w,{partIndex:i}));assert.equal(r.status,200);w=r.week;
    assert.equal(R.partReviews(w.days[0].posts.X).filter(Boolean).length,i+1);
    assert.equal(R.fullyReviewed(w.days[0].posts.X),i===3);
  }
  let r=await c.request(action('confirm-part',w,{partIndex:1}));w=r.week;assert.equal(R.fullyReviewed(w.days[0].posts.X),false);
  r=await c.request(action('nobo-edit',w,{partIndex:1,en:'unused aggregate',parts:['Do not overwrite','Revised one','Do not overwrite','Do not overwrite']}));w=r.week;
  assert.equal(R.englishPart(w.days[0].posts.X,0),'Original 0');assert.equal(R.englishPart(w.days[0].posts.X,1),'Revised one');assert.equal(R.fullyReviewed(w.days[0].posts.X),true);
  r=await c.request(action('nobo-reset',w,{partIndex:1}));w=r.week;
  assert.equal(R.englishPart(w.days[0].posts.X,1),'Original 1');assert.equal(R.partReviews(w.days[0].posts.X)[1],null);assert.ok(R.partReviews(w.days[0].posts.X)[0]);
  assert.equal((await c.request(action('confirm-part',w,{partIndex:4}))).status,400);
});


test('inline Japanese edits preserve English revisions and invalidate only the edited feed',async()=>{
  let w=week('2026-10-26');const p=w.days[0].posts.X;
  p.parts=[{label:'Feed 1',ja:'一',en:'One'},{label:'Feed 2',ja:'二',en:'Two'}];p.noboParts=['One revised','Two revised'];p.noboEn=p.noboParts.join('\n\n');p.secondReview={by:'nobo',kind:'corrected'};
  const c=context({seed:[w]});let r=await c.request(action('edit-japanese',w,{partIndex:0,text:'日本語の修正'}));w=r.week;
  assert.equal(r.status,200);assert.equal(w.days[0].posts.X.parts[0].ja,'日本語の修正');assert.equal(w.days[0].posts.X.parts[1].ja,'二');
  assert.equal(R.englishPart(w.days[0].posts.X,0),'One revised');assert.equal(R.englishPart(w.days[0].posts.X,1),'Two revised');
  assert.equal(R.partReviews(w.days[0].posts.X)[0],null);assert.ok(R.partReviews(w.days[0].posts.X)[1]);
  assert.equal((await c.request(action('edit-japanese',w,{partIndex:0,text:'古い修正',revision:w.revision-1}))).status,409);
  assert.equal((await c.request(action('edit-japanese',w,{partIndex:0,text:'一般会員'}),{id:'guest',member:false})).status,403);
});


test('bulk copy includes posting date, all Japanese/English feeds and corrected comment',()=>{
 const p={parts:[{label:'Feed 1',ja:'本文一',en:'Original first'},{label:'Feed 2',ja:'本文二',en:'Second'},{label:'Comment',ja:'コメント',en:'Original comment'}],noboParts:['First revised','Second revised','Comment revised']};
 const text=R.copyPostText(p,'2026-10-27','X');
 assert.ok(text.startsWith('投稿日: 2026-10-27\nSNS: X\n'));
 for(const value of ['【Feed 1】','本文一','【Feed 2】','本文二','【Comment】','コメント','First revised','Second revised','Comment revised'])assert.ok(text.includes(value),value);
 assert.ok(!text.includes('Original first'));assert.ok(!text.includes('Original comment'));
 const weekend=R.copyPostText({parts:[{label:'Feed 1',ja:'週末',en:'Weekend'}]},'2026-11-01','IG');
 assert.ok(weekend.includes('週末'));assert.ok(weekend.includes('Weekend'));assert.ok(!weekend.includes('Comment'));
 assert.ok(R.copyPostText({ja:'旧形式',en:'Legacy',noboEn:'Revised legacy'},'2026-10-31','IG').includes('Revised legacy'));
});
test('copy formatting separates sentences while preserving URLs, decimals, abbreviations and existing paragraphs',()=>{
 const input='Dr. Smith earned $3.50. Visit https://example.com/v1.2 for details. Ready?\n\n#REEL #GameFi';
 const expected='Dr. Smith earned $3.50.\n\nVisit https://example.com/v1.2 for details.\n\nReady?\n\n#REEL #GameFi';
 assert.equal(R.formatForCopy(input),expected);
 assert.equal(R.formatForCopy(expected),expected);
 assert.equal(R.formatForCopy('The U.S. market grew. We played, e.g. a demo. Then we wrote a review.'),'The U.S. market grew.\n\nWe played, e.g. a demo.\n\nThen we wrote a review.');
 assert.equal(R.formatForCopy('一つ目の文です。次の文です。','ja'),'一つ目の文です。\n\n次の文です。');
 assert.equal(R.formatForCopy('1. Play the game. 2. Write a review.'),'1. Play the game.\n\n2. Write a review.');
});
test('bulk copy formats reviewed English per feed without changing stored or displayed text',()=>{
 const p={parts:[{label:'Feed 1',ja:'一文です。二文です。',en:'Original. Keep stored.'},{label:'Comment',ja:'コメント',en:'Original comment.'}],noboParts:['Reviewed sentence. Another sentence.','A useful link: https://example.com/v1.2. Read this.']};
 const before=JSON.stringify(p),copy=R.copyPostText(p,'2026-11-02','X');
 assert.ok(copy.includes('Reviewed sentence.\n\nAnother sentence.'));
 assert.ok(copy.includes('https://example.com/v1.2.\n\nRead this.'));
 assert.equal(JSON.stringify(p),before);
 assert.equal(R.englishPart(p,0),'Reviewed sentence. Another sentence.');
});
test('English layout starts on Oct 26 for IG and Nov 1 for X, preserving all earlier drafts',()=>{
 const text='Start here. Learn from real play. Share a useful review. What helped you?';
 assert.equal(R.formatEnglishPost(text,'2026-10-25','IG'),text);
 assert.equal(R.formatEnglishPost(text,'2026-10-31','X'),text);
 assert.equal(R.formatEnglishPost(text,'2026-10-26','IG'),'Start here.\n\nLearn from real play.\nShare a useful review.\n\nWhat helped you?');
 assert.equal(R.formatEnglishPost(text,'2026-11-01','X'),'Start here.\n\nLearn from real play.\n\nShare a useful review.\n\nWhat helped you?');
 for(const pf of ['X','IG']){
  const date=pf==='X'?'2026-11-01':'2026-10-26';
  const formatted=R.formatEnglishPost(text,date,pf);
  assert.equal(formatted.replace(/\s+/g,' '),text);
  assert.equal(R.formatEnglishPost(formatted,date,pf),formatted);
 }
 assert.equal(R.copyPostText({ja:'日本語',en:text},'2026-10-25','IG').split('EN:\n')[1],text);
 assert.equal(R.copyPostText({ja:'日本語',en:text},'2026-10-31','X').split('EN:\n')[1],text);
});
test('whole-day confirmation covers every feed and comment and can be undone',async()=>{
 let w=week('2026-10-26');w.days[0].posts.X.parts=R.partLabels(w.days[0].date,'X').map(label=>({label,ja:'日本語',en:label}));
 const c=context({seed:[w]});let r=await c.request(action('confirm-part',w,{partIndex:0}));w=r.week;
 r=await c.request(action('review2',w));w=r.week;assert.equal(R.partReviews(w.days[0].posts.X).filter(Boolean).length,4);assert.equal(R.fullyReviewed(w.days[0].posts.X),true);
 assert.equal(w.days[0].posts.IG.secondReview,null);
 r=await c.request(action('review2',w));assert.equal(R.fullyReviewed(r.week.days[0].posts.X),false);
});


test('external NOBO checks are employee-only metadata without draft text',async()=>{
 const c=context();let reads=0;
 c.hub.env.CHORES.get=async key=>{
  if(key!=='reel:external-reviews:2026-10-20-26:v1')return null;
  reads++;return{reviews:[{date:'2026-10-20',platform:'X',text:'Must not leak'}, {date:'2026-10-26',platform:'IG'}, {date:'2026-10-27',platform:'X'}, {date:'2026-10-20',platform:'IGS'}]};
 };
 assert.equal((await c.request(null,null)).status,401);assert.equal(reads,0);
 const r=await c.request(null,{id:'nobo',member:true});assert.equal(r.status,200);assert.equal(r.externalReviews.length,2);
 assert.deepEqual(r.externalReviews[0],{date:'2026-10-20',platform:'X',by:'NOBO',external:true});assert.equal(r.weeks.length,0);
});


test('Oct 26 IG supplement imports pending without replacing later manuscripts',async()=>{
 const w=week('2026-10-26');w.days=w.days.slice(1);const c=context({seed:[w]});
 c.hub.env.CHORES.get=async key=>key==='reel:prepared:2026-10-26-ig:v1'?{version:1,weeks:[{start:'2026-10-26',theme:'Theme',arc:'Arc',days:[{date:'2026-10-26',posts:{IG:{parts:[{ja:'スタンプ',en:'One stamp left.'},{ja:'質問',en:'What do you collect?'}]}}}]}]}:null;
 const r=await c.request();const d=r.weeks[0].days.find(d=>d.date==='2026-10-26');
 assert.equal(r.weeks[0].days.length,7);assert.equal(d.posts.X,undefined);assert.equal(d.posts.IG.secondReview,null);assert.equal(d.posts.IG.parts.length,2);
 assert.equal(r.weeks[0].days[1].posts.X.en,w.days[0].posts.X.en);
});


test('only NOBO or configured admins may confirm; staff edits cannot implicitly confirm',async()=>{
 const w=week('2026-10-26'),c=context({seed:[w],user:{id:'editor',member:true}});
 assert.equal((await c.request(action('review2',w))).status,403);
 assert.equal((await c.request(action('confirm-part',w,{partIndex:0}))).status,403);
 const edited=await c.request(action('nobo-edit',w,{en:'Employee edited English'}));assert.equal(edited.status,200);
 assert.equal(edited.week.days[0].posts.X.secondReview,null);assert.deepEqual(R.partReviews(edited.week.days[0].posts.X),[null]);
 const confirmed=await c.request(action('confirm-part',edited.week,{partIndex:0}),{id:'NoBo',member:true});assert.equal(confirmed.status,200);
 assert.equal(confirmed.week.days[0].posts.X.partReviews[0].admin,false);
 assert.equal((await c.request(action('confirm-part',confirmed.week,{partIndex:0}),{id:'editor',member:true,admin:true})).status,403);
 assert.equal((await c.request(action('nobo-reset',confirmed.week),{id:'editor',member:true})).status,403);
 assert.equal((await c.request(action('edit',confirmed.week,{ja:'上書き',en:'Overwrite'}))).status,403);
});
test('admin confirmation is recorded by the server and NOBO can subsequently replace it',async()=>{
 const w=week('2026-10-26'),c=context({seed:[w],user:{id:'admin',member:true}});
 let r=await c.request(action('review2',w,{admin:false}));assert.equal(r.status,200);
 assert.equal(r.week.days[0].posts.X.partReviews[0].admin,true);assert.equal(r.week.days[0].posts.X.secondReview.admin,true);
 r=await c.request(action('review2',r.week),{id:'NOBO',member:true});assert.equal(r.week.days[0].posts.X.secondReview,null);
 r=await c.request(action('review2',r.week,{admin:true}));assert.equal(r.week.days[0].posts.X.secondReview.admin,false);
});


test('Korean public and substitute holidays differ from Japanese holidays',()=>{
 assert.equal(R.koreanHoliday('2026-10-09'),'ハングルの日');
 assert.equal(R.koreanHoliday('2026-10-05'),'振替休日：開天節');
 assert.equal(R.koreanHoliday('2026-02-17','ko'),'설날');
 assert.equal(R.koreanHoliday('2026-03-02','en'),'Alternative holiday for Independence Movement Day');
 assert.equal(R.koreanHoliday('2026-10-12'),'');
});
test('employees share manual holidays with Booking without changing drafts or confirmations',async()=>{
 const w=week('2026-10-26'),c=context({seed:[w],user:{id:'employee',member:true}});
 let r=await c.request({op:'holiday',date:'2026-10-27',holiday:true});assert.equal(r.status,200);assert.equal(r.holidays['2026-10-27'],true);
 assert.equal(await c.storage.get('bk:h:2026-10-27'),true);assert.deepEqual(await c.storage.get('reel:week:'+w.start),w);
 r=await c.request(null,{id:'NOBO',member:true});assert.equal(r.holidays['2026-10-27'],true);
 r=await c.request({op:'holiday',date:'2026-10-27',holiday:false});assert.equal(r.holidays['2026-10-27'],false);
 assert.equal((await c.request({op:'holiday',date:'2026-10-27',holiday:true},{id:'guest',member:false})).status,403);
 assert.equal((await c.request({op:'holiday',date:'2026-02-30',holiday:true},{id:'employee',member:true})).status,400);
});


test('November prepared manuscripts add a full month without overwriting NOBO edits or importing December',async()=>{
 const c=context({seed:[{start:'2026-10-26',theme:'October',arc:'October arc',revision:8,days:[{date:'2026-11-01',posts:{X:{ja:'既存11月1日',en:'Existing November 1',noboEn:'NOBO November 1',secondReview:{by:'nobo'},partReviews:[{by:'nobo'}]}}}]}]});
 let reads=0;
 const source={version:1,weeks:[{start:'2026-10-26',theme:'October',arc:'October arc',days:[{date:'2026-11-01',posts:{X:{parts:[{ja:'新規',en:'Incoming'}]},IG:{parts:[{ja:'週末',en:'Weekend'}]}}}]},{start:'2026-11-30',theme:'A new step',arc:'Responses and next play',days:[{date:'2026-11-30',posts:Object.fromEntries(['X','IG'].map(pf=>[pf,{parts:R.partLabels('2026-11-30',pf).map(label=>({ja:'11月 '+label,en:'November '+label}))}]))}]}]};
 c.hub.env.CHORES.get=async key=>{if(key==='reel:prepared:2026-11:v1'){reads++;return source;}return null;};
 let r=await c.request(null,{id:'staff',member:true});assert.equal(r.status,200);
 assert.equal(r.weeks.find(w=>w.start==='2026-10-26').days[0].posts.X.noboEn,'NOBO November 1');
 const nov=r.weeks.find(w=>w.start==='2026-11-30').days[0];assert.equal(nov.posts.X.parts.length,4);assert.equal(nov.posts.IG.parts.length,2);assert.equal(nov.posts.X.secondReview,null);
 await c.request();assert.equal(reads,1);assert.equal(R.EDITOR_END_DATE,'2026-11-30');
 const bad=context();bad.hub.env.CHORES.get=async key=>key==='reel:prepared:2026-11:v1'?{version:1,weeks:[{start:'2026-11-30',theme:'Bad',arc:'Bad arc',days:[{date:'2026-12-01',posts:{}}]}]}:null;
 await assert.rejects(bad.request(),/prepared-date/);assert.equal((await bad.storage.list({prefix:'reel:week:'})).size,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bookRows=JSON.parse(readFileSync(new URL('../book_rows.json',import.meta.url)));
const helpers=source.slice(source.indexOf('  function bkMonthPlan('),source.indexOf('  // 休日: 手で切り替えた日は'));
function context(lang='ja'){
 const c={bookRows,Date,lang,schedule:{assignees:{},slots:[]},slotCh:s=>s.channel,esc:s=>String(s),chanOf:id=>({name:id})};
 vm.createContext(c);vm.runInContext(helpers+source.slice(source.indexOf('  function bkWhoName('),source.indexOf('  function renderBook()')),c);return c;
}
test('the November chart updates date-header primary owners despite older assignments; new manual overrides and explicit unassigned survive',()=>{
 const c=context();c.schedule.assignees={'2026-11-04':'Suha','2026-10-31':'Seohyun'};
 assert.equal(c.bkPrimaryOwner('2026-11-04'),'Hyejeong');
 assert.equal(c.bkPrimaryOwner('2026-11-03'),'Suha');
 assert.equal(c.bkPrimaryOwner('2026-10-31'),'Seohyun');
 const key=c.bkPrimaryKey('2026-11-04');assert.equal(key,'primary-owner|2026-11-04|20261102');
 c.schedule.primaryOwners={[key]:'JiSeong'};assert.equal(c.bkPrimaryOwner('2026-11-04'),'JiSeong');
 c.schedule.primaryOwners[key]='';assert.equal(c.bkPrimaryOwner('2026-11-04'),'');
 assert.equal(c.bkPrimaryKey('2026-11-31'),'');assert.equal(c.bkPrimaryKey('2026-12-01'),'');
});
test('latest instruction assigns every REEL channel and task to JiSeong',()=>{
 const c=context(),m=bookRows.monthlyPlans['2026-11'];
 for(let n=1;n<=30;n++){
  const day=`2026-11-${String(n).padStart(2,'0')}`;
  assert.equal(c.bkPlanOwner('reel',['IG'],day),'JiSeong');
  assert.equal(c.bkPlanOwner('reel',['X'],day),'JiSeong');
 }
 assert.equal(m.targets.find(r=>r.channel==='reel'&&r.platform==='Telegram').owner,'JiSeong');
 assert.equal(c.bkPlanOwner('reel',['IG'],'2026-10-31'),'');
 assert.equal(c.bkPlanOwner('reel',['IG'],'2026-11-31'),'');
 assert.equal(c.bkPlanOwner('reel',['IG'],'2026-12-01'),'');
});
test('HIYOKO and NACHA owner transitions follow the colored date columns',()=>{
 const c=context();
 for(const [day,owner]of [['01','SuHa'],['04','HyeJeong'],['08','SuHa'],['11','HyeJeong'],['14','SuHa'],['15','HyeJeong'],['20','SuHa'],['29','HyeJeong']]){
  for(const pf of ['IG','FB','X','YT'])assert.equal(c.bkPlanOwner('hiyoko',[pf],'2026-11-'+day),owner);
 }
 for(const [day,owner]of [['01','SuHa'],['02','HyeJeong'],['03','SuHa'],['04','HyeJeong'],['05','SuHa'],['06','HyeJeong'],['07','HyeJeong'],['08','EunYeong'],['30','EunYeong']]){
  for(const pf of ['IG','FB','X','YT','TT'])assert.equal(c.bkPlanOwner('nacha',[pf],'2026-11-'+day),owner);
 }
 assert.equal(c.bkPlanOwner('hiyoko',['TT'],'2026-11-04'),'');
 assert.equal(c.bkPlanOwner('yuyu',['X'],'2026-11-04'),'');
});
test('RET uses four explicit November dates, retaining the Saturday rule in other months',()=>{
 const c=context();
 for(const row of bookRows.groups.find(g=>g.channel==='ret').rows){
  const dates=[];
  for(let n=1;n<=30;n++){
   const day=`2026-11-${String(n).padStart(2,'0')}`;if(c.bkRowPlanned(row,day))dates.push(day);
  }
  assert.deepEqual(dates,['2026-11-05','2026-11-12','2026-11-19','2026-11-26']);
  assert.equal(c.bkRowPlanned(row,'2026-10-31'),true);
  assert.equal(c.bkRowPlanned(row,'2026-12-05'),true);
  assert.equal(c.bkRowPlanned(row,'2026-12-03'),false);
 }
});
test('monthly targets remain targets and the summary does not label one day’s owner as the monthly owner',()=>{
 for(const lang of ['ja','en','ko']){
  const c=context(lang),html=c.bkMonthHTML('2026-11-02');
  assert.doesNotMatch(html,/S\/H/);assert.match(html,/JiSeong/);assert.match(html,/60/);assert.match(html,/12/);assert.match(html,/4/);
  assert.equal(c.bkMonthHTML('2026-12-01'),'');
 }
 const m=bookRows.monthlyPlans['2026-11'];
 assert.equal(m.targets.find(r=>r.channel==='hiyoko'&&r.platform==='IG / FB').volume,60);
 assert.equal(m.targets.find(r=>r.channel==='nacha'&&r.platform==='TT').volume,12);
 assert.equal(Object.keys(m.owners.reel.IG).length,30);
});

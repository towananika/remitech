import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('  var reelReplyRevision ='),source.indexOf('  function isReelPage()'));
const lists=JSON.parse(readFileSync(new URL('../chores.json',import.meta.url))).lists;
function setup(reason){
  const cache=new Map();
  const context={Date,JSON,Object,chores:{lists,done:{'2026-10-30':{'reel|IG|reply':true}},at:{}},choreBusy:false,choreEtag:'old',
    authUser:()=>({member:true}),tgPostDay:()=> '2026-10-30',
    lkDue:(t,d)=>!t.weekdays||![0,6].includes(new Date(d+'T00:00:00Z').getUTCDay()),
    localStorage:{setItem:(k,v)=>cache.set(k,v)},CHORE_LOCAL:'test',
    choreMine:()=>JSON.parse(cache.get('test')||'{}')};
  context.lkDayDone=day=>context.chores.done[day]||{};
  context.saveChore=async(day,id,on)=>{
    context.calls.push({day,id,on});
    const c=context.chores;c.done[day]??={};c.at[day]??={};
    if(on){c.done[day][id]=true;c.at[day][id]='new';}else{delete c.done[day][id];delete c.at[day][id];}
    const pending=context.choreMine();pending[day]??={};pending[day][id]=on;
    cache.set('test',JSON.stringify(pending));
    if(reason)throw {reason};
    delete pending[day][id];cache.set('test',JSON.stringify(pending));
    return {where:'server'};
  };
  context.calls=[];vm.createContext(context);vm.runInContext(helpers,context);return context;
}
test('REEL prep resolves the existing X/IG task IDs and excludes other channels, weekends and invalid dates',()=>{
  const c=setup();
  assert.equal(c.reelReplyTask('2026-10-30','X').id,'reel|X|reply');
  assert.equal(c.reelReplyState('2026-10-30','X').on,false);
  assert.equal(c.reelReplyState('2026-10-30','IG').on,true);
  for(const [d,p]of [['2026-10-31','X'],['2026-11-01','IG'],['2026-10-30','IGS'],['2026-02-30','X'],['bad','IG']])assert.equal(c.reelReplyTask(d,p),null);
});
test('completion and undo touch only the selected date and SNS',async()=>{
  const c=setup();await c.setReelReply('2026-10-30','X',true);
  assert.equal(c.chores.done['2026-10-30']['reel|X|reply'],true);
  assert.equal(c.chores.done['2026-10-30']['reel|IG|reply'],true);
  await c.setReelReply('2026-10-30','X',false);
  assert.equal(c.reelReplyState('2026-10-30','X').on,false);
  assert.equal(c.reelReplyState('2026-10-30','IG').on,true);
  assert.equal(c.choreBusy,false);
});
for(const reason of ['offline','code','need-code','many'])test(`failed ${reason} save restores task, timestamp and existing local queue`,async()=>{
  const c=setup(reason);
  c.chores.at['2026-10-30']={'reel|IG|reply':'original'};
  c.localStorage.setItem('test',JSON.stringify({'2026-10-30':{'reel|IG|reply':true,'other|X|task':false}}));
  await assert.rejects(c.setReelReply('2026-10-30','IG',false));
  assert.equal(c.reelReplyState('2026-10-30','IG').on,true);
  assert.equal(c.chores.at['2026-10-30']['reel|IG|reply'],'original');
  assert.deepEqual(c.choreMine(),{'2026-10-30':{'reel|IG|reply':true,'other|X|task':false}});
  await assert.rejects(c.setReelReply('2026-10-30','X',true));
  assert.equal(c.reelReplyState('2026-10-30','X').on,false);
  assert.equal(c.choreMine()['2026-10-30']['reel|X|reply'],undefined);
  assert.equal(c.choreBusy,false);
});
test('future dates, non-members and concurrent saves cannot write a task',async()=>{
  const c=setup();await assert.rejects(c.setReelReply('2026-11-02','X',true));
  c.authUser=()=>({member:false});await assert.rejects(c.setReelReply('2026-10-30','X',true));
  c.authUser=()=>({member:true});c.choreBusy=true;await assert.rejects(c.setReelReply('2026-10-30','X',true));
  assert.equal(c.calls.length,0);
});

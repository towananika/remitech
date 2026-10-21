import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('  function bkRetWeekendBlocked('),end=source.indexOf('  function bkSetSlotState(',start);
const scope=vm.createContext({schedule:{slots:[]},slotCh:x=>x.channel});vm.runInContext(source.slice(start,end),scope);
test('RET weekend mutual exclusion is per SNS and restores after cancellation',()=>{
 const slot={channel:'ret',platform:'X',date:'2026-10-24',scheduled:true};scope.schedule.slots=[slot];
 assert.equal(scope.bkRetWeekendBlocked('ret','X','2026-10-25'),'2026-10-24');
 assert.equal(scope.bkRetWeekendBlocked('ret','IG','2026-10-25'),'');
 assert.equal(scope.bkRetWeekendBlocked('reel','X','2026-10-25'),'');
 assert.equal(scope.bkRetWeekendBlocked('ret','X','2026-10-24'),'');
 assert.equal(scope.bkRetWeekendBlocked('ret','X','2026-11-01'),'');
 slot.scheduled=false;assert.equal(scope.bkRetWeekendBlocked('ret','X','2026-10-25'),'');
 slot.scheduled=true;slot.skip=true;assert.equal(scope.bkRetWeekendBlocked('ret','X','2026-10-25'),'');
});
test('Sunday booking blocks Saturday across a month boundary; existing reservations can be canceled',()=>{
 scope.schedule.slots=[{channel:'ret',platform:'IG',date:'2026-11-01',scheduled:true}];
 assert.equal(scope.bkRetWeekendBlocked('ret','IG','2026-10-31'),'2026-11-01');
 scope.schedule.slots.push({channel:'ret',platform:'IG',date:'2026-10-31',scheduled:true});
 assert.equal(scope.bkRetWeekendBlocked('ret','IG','2026-10-31'),'');
});

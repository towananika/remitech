import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function setup(shared){
 const calls=[];
 const c=vm.createContext({channels:[{id:'hiyoko',telegramAt:{time:'17:00'}},{id:'nacha',telegramAt:{time:'20:00'},shareDayOffset:-1},{id:'ret'}],schedule:{telegram:shared},tgDate:'2026-10-21',t:k=>k,bkFetchShow:x=>calls.push(x),bkFetchStart:x=>calls.push(x)});
 vm.runInContext(s.slice(s.indexOf('  function tgPendingFetch()'),s.indexOf('  function bkFetchStart(')),c);
 return {c,calls};
}
test('all shared Telegram notifications do not request another fetch',()=>{const {c,calls}=setup({'2026-10-21|hiyoko':true,'2026-10-21|nacha':true});c.tgFetchStart();assert.deepEqual(calls,['tgShared']);});
test('mixed shares retain only unshared channels using notification date',()=>{const {c,calls}=setup({'2026-10-21|nacha':true});assert.deepEqual(Array.from(c.tgPendingFetch(),x=>x.id),['hiyoko']);c.tgFetchStart();assert.equal(calls[0].scope,'telegram');assert.equal(calls[0].date,'2026-10-21');});
test('previous dates and undone shares can fetch again',()=>{const {c}=setup({'2026-10-20|hiyoko':true,'2026-10-21|nacha':false});assert.equal(c.tgPendingFetch().length,2);});

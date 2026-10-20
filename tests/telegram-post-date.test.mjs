import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('  function tgPostDay('),end=source.indexOf('  function tgShareText(',start);
const scope=vm.createContext({});vm.runInContext(source.slice(start,end),scope);
test('Telegram dates use Korea time across UTC midnight, independent of browser timezone',()=>{
 assert.equal(scope.tgPostDay('2026-10-19T15:00:00Z'),'2026-10-20');
 assert.equal(scope.tgPostDay('2026-10-20T14:59:59Z'),'2026-10-20');
 assert.equal(scope.tgPostDay('2026-10-20T15:00:00Z'),'2026-10-21');
 for(const value of ['',null,'invalid','2026-10-20','2026-10-20T11:00:00'])assert.equal(scope.tgPostDay(value),'');
});
test('only same-day actual posts are verified, excluding pinned, unsafe and undated links',()=>{
 const p=(url,at,extra={})=>({url,at,...extra});
 const account={posts:[p('https://x.com/a/status/old','2026-10-19T14:59:59Z'),p('https://x.com/a/status/today','2026-10-19T15:00:00Z'),p('https://x.com/a/status/future','2026-10-20T15:00:00Z'),p('https://x.com/a/status/pinned','2026-10-20T01:00:00Z',{pinned:true}),p('javascript:alert(1)','2026-10-20T01:00:00Z'),p('https://x.com/a/status/unknown',''),p('https://x.com/a/status/later','2026-10-20T04:00:00Z')]};
 assert.deepEqual(Array.from(scope.tgVerifiedPosts(account,'2026-10-20'),p=>p.url),['https://x.com/a/status/today','https://x.com/a/status/later']);
 assert.equal(scope.tgVerifiedPosts(null,'2026-10-20').length,0);
});

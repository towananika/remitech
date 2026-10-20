import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('  function tgPostDay('),end=source.indexOf('  function tgShareText(',start);
const scope=vm.createContext({URL});vm.runInContext(source.slice(start,end),scope);
test('Telegram dates use Korea time across UTC midnight, independent of browser timezone',()=>{
 assert.equal(scope.tgPostDay('2026-10-19T15:00:00Z'),'2026-10-20');
 assert.equal(scope.tgPostDay('2026-10-20T14:59:59Z'),'2026-10-20');
 assert.equal(scope.tgPostDay('2026-10-20T15:00:00Z'),'2026-10-21');
 for(const value of ['',null,'invalid','2026-10-20','2026-10-20T11:00:00'])assert.equal(scope.tgPostDay(value),'');
});
test('only same-day actual posts are verified, excluding pinned, unsafe and undated links',()=>{
 const p=(url,at,extra={})=>({url,at,...extra});
 const account={posts:[p('https://x.com/a/status/100','2026-10-19T14:59:59Z'),p('https://x.com/a/status/200','2026-10-19T15:00:00Z'),p('https://x.com/a/status/300','2026-10-20T15:00:00Z'),p('https://x.com/a/status/400','2026-10-20T01:00:00Z',{pinned:true}),p('javascript:alert(1)','2026-10-20T01:00:00Z'),p('https://x.com/a/status/500',''),p('https://x.com/a/status/600','2026-10-20T04:00:00Z')]};
 assert.deepEqual(Array.from(scope.tgVerifiedPosts(account,'2026-10-20'),p=>p.url),['https://x.com/a/status/200','https://x.com/a/status/600']);
 assert.equal(scope.tgVerifiedPosts(null,'2026-10-20').length,0);
});

test('post identity rejects broken Facebook permalinks and preserves query identifiers',()=>{
 assert.equal(scope.tgPostKey('https://www.facebook.com/permalink.php','FB'),'');
 assert.equal(scope.tgPostKey('https://www.facebook.com/permalink.php?story_fbid=123&id=456&__cft__=tracking','FB'),'https://facebook.com/permalink.php?story_fbid=123&id=456');
 assert.equal(scope.tgPostKey('https://www.youtube.com/watch?v=abcdefghijk&feature=share','YT'),'https://youtube.com/watch?v=abcdefghijk');
 for(const value of ['https://facebook.com/','https://facebook.com/login','https://facebook.com/watch','https://not-facebook.com/reel/123','https://x.com/user'])assert.equal(scope.tgPostKey(value,'FB'),'');
});
test('Facebook needs a recent successful check for the exact post URL',()=>{
 const url='https://www.facebook.com/permalink.php?story_fbid=123&id=456';
 const p={url,at:'2026-10-20T01:00:00Z'};
 assert.equal(scope.tgLinkChecked(p,'FB'),false);
 p.linkCheck={state:'ok',url,checkedAt:new Date().toISOString()};assert.equal(scope.tgLinkChecked(p,'FB'),true);
 for(const check of [{...p.linkCheck,state:'unverified'},{...p.linkCheck,state:'unavailable'},{...p.linkCheck,url:'https://facebook.com/reel/123'},{...p.linkCheck,checkedAt:'2020-01-01T00:00:00Z'}])assert.equal(scope.tgLinkChecked({...p,linkCheck:check},'FB'),false);
});

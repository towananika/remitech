import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const L=k=>({kind:k});
const CH=[{id:'hiyoko',telegramAt:{time:'17:00'},links:[L('X'),L('Instagram'),L('YouTube')]},{id:'nacha',telegramAt:{time:'09:00'},shareDayOffset:-1,links:[L('X'),L('TikTok')]},{id:'ret',links:[L('X')]}];
const post=(url,at,extra={})=>({posts:[{url,at,...extra}]});
function setup(shared,accounts={}){
 const calls=[];
 const c=vm.createContext({URL,channels:CH,schedule:{telegram:shared},tgDate:'2026-10-21',t:k=>k,bkFetchShow:x=>calls.push(x),bkFetchStart:x=>calls.push(x),pcAcct:(id,pf)=>accounts[id+'|'+pf]||null});
 vm.runInContext(s.slice(s.indexOf('  function tgDueAt('),s.indexOf('  function bkFetchStart(')),c);
 vm.runInContext(s.slice(s.indexOf('  function tgPostDay('),s.indexOf('  function tgShareText(')),c);
 return {c,calls};
}
const at=(hm,day='2026-10-21')=>Date.parse(day+'T'+hm+':00+09:00');
const ids=(c,now)=>Array.from(c.tgPendingFetch(now),x=>x.id);
test('share times are NACHA 09:00 and others 17:00 (KST) in posts.json',()=>{
 const p=JSON.parse(readFileSync(new URL('../posts.json',import.meta.url),'utf8'));
 const m=Object.fromEntries(p.channels.filter(c=>c.telegramAt).map(c=>[c.id,c.telegramAt.time]));
 assert.equal(m.nacha,'09:00');for(const [id,v] of Object.entries(m))if(id!=='nacha')assert.equal(v,'17:00',id);
});
test('only channels past their share time are refreshed',()=>{
 const {c}=setup({});
 assert.deepEqual(ids(c,at('08:59')),[]);
 assert.deepEqual(ids(c,at('09:00')),['nacha']);
 assert.deepEqual(ids(c,at('16:59')),['nacha']);
 assert.deepEqual(ids(c,at('17:00')),['nacha','hiyoko'].sort((a,b)=>CH.findIndex(x=>x.id===a)-CH.findIndex(x=>x.id===b)));
});
test('shared channels are not refreshed; undone shares are',()=>{
 assert.deepEqual(ids(setup({'2026-10-21|nacha':true}).c,at('18:00')),['hiyoko']);
 assert.deepEqual(ids(setup({'2026-10-21|nacha':false,'2026-10-20|hiyoko':true}).c,at('18:00')),['hiyoko','nacha']);
 const {c,calls}=setup({'2026-10-21|hiyoko':true,'2026-10-21|nacha':true});c.tgFetchStart();assert.deepEqual(calls,['tgNoFetch']);
});
test('channels whose required links are already fetched are not refreshed again',()=>{
 const acc={'hiyoko|X':post('https://x.com/h/status/1','2026-10-21T08:00:00Z'),'hiyoko|IG':post('https://instagram.com/p/abc','2026-10-21T08:00:00Z'),
  'nacha|X':post('https://x.com/n/status/1','2026-10-20T11:00:00Z')};
 // HIYOKO: X・IG あり（YouTube は任意）→ 済み。NACHA: 前日の X はあるが TikTok がまだ → 対象
 assert.deepEqual(ids(setup({},acc).c,at('18:00')),['nacha']);
 acc['nacha|TT']=post('https://tiktok.com/@n/video/1','2026-10-20T11:00:00Z');
 assert.deepEqual(ids(setup({},acc).c,at('18:00')),[]);
 const {c,calls}=setup({},acc);c.tgFetchStart();assert.deepEqual(calls,['tgNoFetch']);
});
test('a post from another day does not count as fetched; request carries the notification date',()=>{
 const acc={'nacha|X':post('https://x.com/n/status/1','2026-10-21T11:00:00Z'),'nacha|TT':post('https://tiktok.com/@n/video/1','2026-10-21T11:00:00Z')};
 const {c,calls}=setup({},acc);
 assert.deepEqual(ids(c,at('10:00')),['nacha']);
 c.tgPendingFetch=()=>[1];c.tgFetchStart();assert.equal(calls[0].scope,'telegram');assert.equal(calls[0].date,'2026-10-21');
});

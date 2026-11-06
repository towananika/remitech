import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const posts=JSON.parse(readFileSync(new URL('../posts.json',import.meta.url),'utf8'));
const all=posts.channels.flatMap(c=>(c.snippets||[]).map(sn=>({c:c.id,sn})));
test('snippet groups cover every item exactly once, in order',()=>{
 for(const {c,sn} of all.filter(x=>x.sn.groups)){
  assert.equal(sn.groups.reduce((n,g)=>n+g.count,0),sn.items.length,c+' '+sn.title);
  assert.ok(sn.groups.every(g=>g.name&&g.count>0),sn.title);
 }
});
test('snippet items are unique strings within their max length',()=>{
 for(const {sn} of all){
  assert.equal(new Set(sn.items).size,sn.items.length,sn.title);
  if(sn.max)assert.ok(sn.items.every(x=>typeof x==='string'&&x.length<=sn.max),sn.title);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto=webcrypto;
// Exercise the production auth methods with only Cloudflare's runtime base stubbed.
let source=await readFile(new URL('../worker/chores-worker.js',import.meta.url),'utf8');
source=source.replace('import { DurableObject } from "cloudflare:workers";','class DurableObject {}');
source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,path)=>'from '+JSON.stringify(new URL('../worker/'+path,import.meta.url).href));
const {HubDO}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function setup(actor='owner'){
 const data=new Map([['u:owner',{id:'owner',member:true,created:'2026-10-01'}],['u:staff',{id:'staff',member:true,created:'2026-10-02',salt:'private',hash:'private'}],['ss:staff',{id:'staff',exp:Date.now()+10000}],['ss:owner',{id:'owner',exp:Date.now()+10000}]]);
 const storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix)))};
 const hub=Object.create(HubDO.prototype);hub.ctx={storage};hub.env={ADMIN_IDS:'owner'};hub.session=async()=>actor?{user:data.get('u:'+actor)}:null;
 const call=async(op,body)=>{const r=await hub.auth(op,new Request('https://test/auth/'+op,{method:op==='users'?'GET':'POST',headers:{Origin:'http://localhost:8899'},body:op==='users'?undefined:JSON.stringify(body||{})}),'http://localhost:8899');return {status:r.status,...await r.json()};};
 return{hub,data,call};
}
test('every management endpoint rejects anonymous and non-admin callers',async()=>{
 for(const actor of [null,'staff'])for(const op of ['users','member','resetcode','delete','suspend','revoke']){
  const c=setup(actor);assert.equal((await c.call(op,{id:'staff',member:false,suspended:true})).status,actor?403:401);assert.equal(c.data.get('u:staff').member,true);
 }
});
test('staff access changes immediately and does not expose password hashes',async()=>{
 const c=setup();let r=await c.call('member',{id:'staff',member:false});assert.equal(r.user.member,false);assert.equal(r.user.hash,undefined);
 r=await c.call('users');assert.equal(r.users.length,2);assert.ok(r.users.every(u=>u.hash===undefined&&u.salt===undefined));
 assert.equal((await c.call('member',{id:'staff',member:'false'})).status,400);
});
test('suspension and force logout revoke only the selected account sessions',async()=>{
 const c=setup();let r=await c.call('suspend',{id:'STAFF',suspended:true});assert.equal(r.user.suspended,true);assert.equal(c.data.has('ss:staff'),false);assert.equal(c.data.has('ss:owner'),true);
 r=await c.call('suspend',{id:'staff',suspended:false});assert.equal(r.user.suspended,false);
 c.data.set('ss:staff2',{id:'staff',exp:Date.now()+10000});assert.equal((await c.call('revoke',{id:'staff'})).ok,true);assert.equal(c.data.has('ss:staff2'),false);
 assert.equal((await c.call('suspend',{id:'staff',suspended:'false'})).status,400);
});
test('administrator accounts cannot be downgraded, suspended, deleted or force logged out',async()=>{
 for(const op of ['member','suspend','delete','revoke']){const c=setup();assert.equal((await c.call(op,{id:'owner',member:false,suspended:true})).status,400);assert.ok(c.data.has('u:owner'));}
});
test('suspended accounts cannot use an existing bearer session',async()=>{
 const c=setup();const token='a'.repeat(64),hash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))).toString('hex');
 c.data.set('ss:'+hash,{id:'staff',exp:Date.now()+10000});c.data.get('u:staff').suspended=true;
 assert.equal(await HubDO.prototype.session.call(c.hub,new Request('https://test',{headers:{Authorization:'Bearer '+token}})),null);
});

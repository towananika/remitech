import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto=webcrypto;
// Owner (ADMIN_IDS) / stored admins / general users (2026-11-09).
let source=await readFile(new URL('../worker/chores-worker.js',import.meta.url),'utf8');
source=source.replace('import { DurableObject } from "cloudflare:workers";','class DurableObject {}');
source=source.replace(/from "(\.\/[^"\n]+)"/g,(_,path)=>'from '+JSON.stringify(new URL('../worker/'+path,import.meta.url).href));
const {HubDO}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function setup(actor){
 const data=new Map([['u:owner',{id:'owner',member:true}],['u:boss',{id:'boss',member:true,admin:true}],['u:boss2',{id:'boss2',member:true,admin:true}],['u:fan',{id:'fan',member:false}],['u:fan2',{id:'fan2',member:false}],['ss:x',{id:'boss2',exp:Date.now()+1e5}]]);
 const storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix)))};
 const hub=Object.create(HubDO.prototype);hub.ctx={storage};hub.env={ADMIN_IDS:'owner'};hub.session=async()=>actor?{user:data.get('u:'+actor)}:null;
 const call=async(op,body)=>{const r=await hub.auth(op,new Request('https://test/auth/'+op,{method:op==='users'?'GET':'POST',headers:{Origin:'http://localhost:8899'},body:op==='users'?undefined:JSON.stringify(body||{})}),'http://localhost:8899');return {status:r.status,...await r.json()};};
 return{hub,data,call};
}
test('owner can make and remove admins; admin flag makes member',async()=>{
 const c=setup('owner');let r=await c.call('admin',{id:'fan',admin:true});assert.equal(r.user.admin,true);assert.equal(r.user.member,true);assert.equal(r.user.owner,false);
 r=await c.call('admin',{id:'fan',admin:false});assert.equal(r.user.admin,false);
});
test('admins can promote others but cannot demote, and nobody can touch the owner',async()=>{
 const c=setup('boss');assert.equal((await c.call('admin',{id:'fan',admin:true})).user.admin,true);
 assert.equal((await c.call('admin',{id:'boss2',admin:false})).status,403);
 assert.equal((await c.call('admin',{id:'owner',admin:false})).status,400);
 for(const op of ['suspend','delete','revoke','member'])assert.equal((await c.call(op,{id:'boss2',suspended:true,member:false})).status,400);
 assert.equal(c.data.has('ss:x'),true);
});
test('owner can suspend an admin, which removes admin power',async()=>{
 const c=setup('owner');assert.equal((await c.call('suspend',{id:'boss',suspended:true})).user.admin,false);
});
test('general users cannot use admin operations',async()=>{
 const c=setup('fan');assert.equal((await c.call('admin',{id:'fan2',admin:true})).status,403);assert.equal(c.data.get('u:fan2').admin,undefined);
});
test('register makes a general user and keeps an optional email without granting rights',async()=>{
 const c=setup(null);c.hub.limited=async()=>false;c.hub.bump=async()=>{};
 let r=await c.call('register',{id:'newbie',pw:'longpassword',email:'Jaykim.Can@Gmail.com'});
 assert.equal(r.ok,true);assert.equal(r.user.member,false);assert.equal(r.user.admin,false);assert.equal(r.user.email,'jaykim.can@gmail.com');
 assert.equal((await c.call('register',{id:'bad1',pw:'longpassword',email:'nope'})).status,400);
});

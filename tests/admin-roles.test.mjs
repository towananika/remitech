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
test('NACHA uses the same accounts and sessions as the hub, with its own roles and owner',async()=>{
 const data=new Map([['u:hubstaff',{id:'hubstaff',member:true,admin:true}],['u:fan',{id:'fan',member:false,sites:{nacha:{joined:'x'}}}],['u:nboss',{id:'nboss',member:false}]]);
 const storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix)))};
 const hub=Object.create(HubDO.prototype);hub.ctx={storage};hub.env={ADMIN_IDS:'hubowner',NACHA_OWNER_IDS:'nboss',CHORES:{get:async k=>k==='nin:nachadev'?{title:'n'}:k==='in:meeting'?{title:'h'}:null}};
 hub.limited=async()=>false;hub.bump=async()=>{};
 const n=hub.nacha();
 const post=(realm,op,body,token)=>realm.auth(op,new Request('https://t/'+op,{method:op==='users'?'GET':'POST',headers:Object.assign({Origin:'http://localhost:8899'},token?{Authorization:'Bearer '+token}:{}),body:op==='users'?undefined:JSON.stringify(body||{})}),'http://localhost:8899').then(async r=>({status:r.status,...await r.json()}));
 // register on NACHA = a normal account, general user on both sites
 let r=await post(n,'register',{id:'newfan',pw:'longpassword'});assert.equal(r.ok,true);assert.equal(r.user.member,false);
 assert.ok(data.has('u:newfan'));assert.ok(data.get('u:newfan').sites.nacha.joined);
 const tok=r.token,req=()=>new Request('https://t/x',{headers:{Authorization:'Bearer '+tok}});
 assert.ok(await hub.session(req()),'NACHA login works on the hub too');
 // hub staff is NOT NACHA staff
 const hs=data.get('u:hubstaff');assert.equal(n.publicUser(hs).member,false);assert.equal(n.publicUser(hs).admin,false);assert.equal(hub.publicUser(hs).admin,true);
 // NACHA owner promotes fan to NACHA admin; hub role unchanged
 n.session=async()=>({user:data.get('u:nboss')});
 r=await post(n,'admin',{id:'fan',admin:true});assert.equal(r.user.admin,true);assert.equal(data.get('u:fan').member,false);assert.equal(hub.publicUser(data.get('u:fan')).admin,false);
 // NACHA admins cannot delete or suspend accounts
 n.session=async()=>({user:data.get('u:fan')});
 for(const op of ['delete','suspend','resetcode','revoke'])assert.equal((await post(n,op,{id:'newfan',suspended:true})).status,404);
 // NACHA user list shows only people who joined NACHA (+ owner), not hub staff
 r=await post(n,'users');assert.deepEqual(r.users.map(u=>u.id).sort(),['fan','nboss','newfan']);
 // documents
 data.get('u:newfan').sites.nacha.member=true;
 assert.equal((await (await n.internal('nachadev',req(),'http://localhost:8899')).json()).title,'n');
 assert.equal((await n.internal('meeting',req(),'http://localhost:8899')).status,404);
 assert.equal((await hub.internal('nachadev',req(),'http://localhost:8899')).status,403,'NACHA staff are not hub staff');
});
test('hub owner is also NACHA owner without extra setup',async()=>{
 const hub=Object.create(HubDO.prototype);hub.env={ADMIN_IDS:'boss'};const n=hub.nacha();
 assert.equal(n.isOwner('boss'),true);assert.equal(n.isOwner('fan'),false);assert.equal(hub.isOwner('boss'),true);
});

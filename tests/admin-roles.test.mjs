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
// Googleでログイン（2026-11-09）
function gsetup(actor){
 const c=setup(actor);c.hub.limited=async()=>false;c.hub.bump=async()=>{};c.hub.env.GOOGLE_CLIENT_ID='cid';
 globalThis.fetch=async u=>{const tok=new URL(u).searchParams.get('id_token');const tk=tok.length>1500?tok.slice(0,4):tok;const m0={good:{aud:'cid',iss:'accounts.google.com',email_verified:'true',exp:String(Date.now()/1000+600),sub:'111',email:'Fan.Club@gmail.com'},other:{aud:'other',iss:'accounts.google.com',email_verified:'true',exp:String(Date.now()/1000+600),sub:'222',email:'x@gmail.com'}}[tk];const m=m0;return new Response(JSON.stringify(m||{}),{status:m?200:400});};
 return c;
}
test('google config exposes only the public client id',async()=>{
 const c=gsetup(null);const r=await c.hub.auth('google-config',new Request('https://test/auth/google-config'),'http://localhost:8899');assert.equal((await r.json()).clientId,'cid');
});
test('google sign-in creates a general user once, then logs into the same account',async()=>{
 const c=gsetup(null);let r=await c.call('google',{credential:'good'});
 assert.equal(r.ok,true);assert.equal(r.user.id,'fan.club');assert.equal(r.user.member,false);assert.equal(r.user.google,'fan.club@gmail.com');
 r=await c.call('google',{credential:'good'});assert.equal(r.user.id,'fan.club');
 assert.equal((await c.call('google',{credential:'other'})).error,'google-aud');
 assert.equal((await c.call('google',{credential:'bad'})).error,'google-invalid');
 assert.equal((await c.call('login',{id:'fan.club',pw:'whatever12'})).status,403);
});
test('google sign-in on NACHA joins NACHA; ids do not collide',async()=>{
 const c=gsetup(null);c.data.set('u:fan.club',{id:'fan.club'});const n=c.hub.nacha();
 const r=await n.auth('google',new Request('https://test/nacha/auth/google',{method:'POST',body:JSON.stringify({credential:'good'})}),'http://localhost:8899');
 const j=await r.json();assert.equal(j.user.id,'fan.club2');assert.ok(c.data.get('u:fan.club2').sites.nacha.joined);
});
test('a logged-in user can link google, then google opens that account',async()=>{
 const c=gsetup('owner');let r=await c.call('googlelink',{credential:'good'});assert.equal(r.ok,true);assert.equal(r.user.google,'fan.club@gmail.com');
 c.hub.session=async()=>null;r=await c.call('google',{credential:'good'});assert.equal(r.user.id,'owner');assert.equal(r.user.owner,true);
});
test('google is off without a client id',async()=>{
 const c=gsetup(null);c.hub.env.GOOGLE_CLIENT_ID='';assert.equal((await c.call('google',{credential:'good'})).status,503);
});
test('front door lets google routes through to the hub object',async()=>{
 const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 let hit=0;const env={HUB:{idFromName:()=>1,get:()=>({fetch:async()=>{hit++;return new Response('{}')}})}};
 for(const p of ['/auth/google','/auth/googlelink','/auth/google-config','/nacha/auth/google','/nacha/auth/googlelink','/nacha/auth/google-config'])await mod.default.fetch(new Request('https://w'+p,{method:'POST'}),env);
 assert.equal(hit,6);
});
// メールで会員登録（2026-11-09）
test('register with email only makes an id, then login works with the email',async()=>{
 const c=setup(null);c.hub.limited=async()=>false;c.hub.bump=async()=>{};
 let r=await c.call('register',{email:'Hello.World@Example.com',pw:'longpassword'});
 assert.equal(r.ok,true);assert.equal(r.user.id,'hello.world');assert.equal(r.user.member,false);
 assert.equal((await c.call('register',{email:'hello.world@example.com',pw:'longpassword'})).status,409);
 r=await c.call('login',{id:'HELLO.WORLD@example.com',pw:'longpassword'});assert.equal(r.ok,true);assert.equal(r.user.id,'hello.world');
 assert.equal((await c.call('login',{id:'hello.world@example.com',pw:'wrongpassword'})).status,403);
 assert.equal((await c.call('login',{id:'nobody@example.com',pw:'longpassword'})).error,'wrong');
 assert.equal((await c.call('login',{id:'hello.world',pw:'longpassword'})).ok,true);
});
test('google-only accounts are not found by email login',async()=>{
 const c=gsetup(null);await c.call('google',{credential:'good'});
 assert.equal((await c.call('login',{id:'fan.club@gmail.com',pw:'longpassword'})).error,'wrong');
});
test('real-size google tokens (over 1KB) are accepted',async()=>{
 const c=gsetup(null);const r=await c.call('google',{credential:'good'+'x'.repeat(1600)});assert.equal(r.ok,true);
});
// オーナーのメール（2026-11-09）
test('google sign-in with the owner email makes the owner; plain email accounts with it do not',async()=>{
 const c=gsetup(null);
 globalThis.fetch=async u=>new Response(JSON.stringify({aud:'cid',iss:'accounts.google.com',email_verified:'true',exp:String(Date.now()/1000+600),sub:'999',email:'Jaykim.Can@gmail.com'}));
 let r=await c.call('register',{email:'jaykim.can@gmail.com',pw:'longpassword'});assert.equal(r.user.owner,false);
 r=await c.call('google',{credential:'x'});assert.equal(r.user.owner,true);assert.equal(r.user.admin,true);assert.equal(r.user.id,'jaykim.can2');
 assert.equal(r.user.hasPassword,false);assert.ok(r.user.lastAt);
 const n=c.hub.nacha();const pu=n.publicUser(c.data.get('u:jaykim.can2'));assert.equal(pu.owner,true);
});

// 開発者の権限と開発資料（2026-11-09）
test('NACHA developer role: admins grant it, only developers read and add dev docs',async()=>{
 const data=new Map([['u:nboss',{id:'nboss'}],['u:adm',{id:'adm',sites:{nacha:{joined:'x',admin:true}}}],['u:fan',{id:'fan',sites:{nacha:{joined:'x'}}}],['u:mem',{id:'mem',sites:{nacha:{joined:'x',member:true}}}]]);
 const storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix)))};
 const kvm=new Map([['nin:nachadev',{v:JSON.stringify({title:'deck'})}]]);
 const kv={get:async(k,t)=>kvm.has(k)?(t==='json'?JSON.parse(kvm.get(k).v):kvm.get(k).v):null,put:async(k,v,o)=>kvm.set(k,{v,m:o&&o.metadata}),delete:async k=>kvm.delete(k),list:async({prefix})=>({keys:[...kvm].filter(([k])=>k.startsWith(prefix)).map(([name,x])=>({name,metadata:x.m})),list_complete:true})};
 const hub=Object.create(HubDO.prototype);hub.ctx={storage};hub.env={NACHA_OWNER_IDS:'nboss',CHORES:kv};hub.limited=async()=>false;hub.bump=async()=>{};
 const n=hub.nacha();let who='fan';n.session=async()=>({key:'ss:t',val:{},user:data.get('u:'+who)});
 const post=(op,body)=>n.auth(op,new Request('https://t/'+op,{method:'POST',body:JSON.stringify(body||{})}),'http://localhost:8899').then(async r=>({status:r.status,...await r.json()}));
 const get=(name)=>n.internal(name,new Request('https://t/x'),'http://localhost:8899');
 // general user and 関係者 cannot see dev docs
 assert.equal((await post('devdocs')).status,403);who='mem';assert.equal((await post('devdocs')).status,403);assert.equal((await get('nachadev')).status,403);
 // 関係者 cannot grant
 assert.equal((await post('dev',{id:'fan',dev:true})).status,403);
 // admin grants dev; admins are always dev
 who='adm';assert.equal(n.publicUser(data.get('u:adm')).dev,true);
 let r=await post('dev',{id:'mem',dev:true});assert.equal(r.user.dev,true);assert.equal(r.user.member,true);
 assert.equal((await post('dev',{id:'nboss',dev:false})).status,400,'owner cannot be changed');
 // developer lists, adds, reads, deletes
 who='mem';r=await post('devdocs');assert.deepEqual(r.docs.map(d=>d.name),['nachadev']);
 r=await post('devput',{name:'dev-memo1',title:'Memo',text:'hello'});assert.equal(r.ok,true);
 r=await post('devdocs');assert.deepEqual(r.docs.map(d=>d.name),['nachadev','dev-memo1']);assert.equal(r.docs[1].title,'Memo');assert.equal(r.docs[1].by,'mem');
 assert.equal((await (await get('dev-memo1')).json()).text,'hello');
 assert.equal((await post('devput',{name:'nachadev',title:'x',text:'y'})).status,400,'cannot overwrite the deck');
 assert.equal((await post('devput',{name:'dev-a',title:'',text:'y'})).status,400);
 assert.equal((await post('devdel',{name:'dev-memo1'})).ok,true);assert.equal(kvm.has('nin:dev-memo1'),false);
 // removing the role closes it again
 who='adm';await post('dev',{id:'mem',dev:false});who='mem';assert.equal((await post('devdocs')).status,403);
});
// フォロー導線のクリック計測（2026-11-11）
test('hit counter: beacon increments per day, admin reads via hits op',async()=>{
 const data=new Map([['u:nboss',{id:'nboss'}],['u:fan',{id:'fan',sites:{nacha:{joined:'x'}}}]]);
 const storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix)))};
 const hub=Object.create(HubDO.prototype);hub.ctx={storage};hub.env={NACHA_OWNER_IDS:'nboss'};hub.limited=async()=>false;hub.bump=async()=>{};
 const req=(m,o)=>new Request('https://t/x',{method:m||'POST',headers:o===null?{}:{Origin:o||'http://localhost:8899'}});
 let r=await hub.hit('nacha','x',req(),'http://localhost:8899');assert.equal((await r.json()).ok,true);
 await hub.hit('nacha','x',req(),'http://localhost:8899');await hub.hit('nacha','ig',req(),'http://localhost:8899');
 const day=new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);
 assert.equal(data.get('hit:nacha:x:'+day),2);assert.equal(data.get('hit:nacha:ig:'+day),1);
 assert.equal((await hub.hit('nacha','x',req('GET'),'http://localhost:8899')).status,405);
 assert.equal((await hub.hit('nacha','x',new Request('https://t/x',{method:'POST'}),'')).status,403,'no origin = refused');
 assert.equal((await hub.hit('nacha','BAD NAME!',req(),'http://localhost:8899')).status,400);
 // admin reads
 const n=hub.nacha();n.session=async()=>({key:'ss:t',val:{},user:data.get('u:nboss')});
 r=await n.auth('hits',new Request('https://t/hits',{method:'POST',body:'{}'}),'http://localhost:8899').then(x=>x.json());
 assert.equal(r.hits.x[day],2);assert.equal(r.hits.ig[day],1);
 // non-admin cannot
 n.session=async()=>({key:'ss:t',val:{},user:data.get('u:fan')});
 assert.equal((await n.auth('hits',new Request('https://t/hits',{method:'POST',body:'{}'}),'http://localhost:8899')).status,403);
});

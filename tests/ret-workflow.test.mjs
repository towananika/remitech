import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let source=await readFile(new URL('../worker/chores-worker.js',import.meta.url),'utf8');
source=source.replace('import { DurableObject } from "cloudflare:workers";','class DurableObject {}').replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../worker/'+p,import.meta.url).href));
const {HubDO}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function setup(actor={id:'staff',member:true}) {
 const data=new Map(), doc={posts:[{date:'2026-12-05',xen:'private manuscript'}]};
 const storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v)),list:async({prefix})=>new Map([...data].filter(([k])=>k.startsWith(prefix)))};
 storage.transaction=async fn=>fn(storage);
 const hub=Object.create(HubDO.prototype);hub.ctx={storage};hub.env={CHORES:{get:async()=>structuredClone(doc)}};hub.session=async()=>actor?{user:actor}:null;hub.publicUser=u=>u;
 const call=async(body,origin='http://localhost:8899')=>{
  const r=await hub.internal('ret',new Request('https://test/internal/ret',{method:body?'POST':'GET',body:body?JSON.stringify(body):undefined}),origin);return {status:r.status,body:await r.json(),cache:r.headers.get('Cache-Control')};
 };
 return {call,data,doc};
}
const body={date:'2026-12-05',revision:0,stage:'reviewed',images:{X:'https://example.com/x.png',IG:''},snsConfirmed:{X:true,IG:false}};
test('staff save metadata and GET merges it without changing private manuscripts',async()=>{
 const c=setup();assert.equal((await c.call()).body.posts[0].workflow.stage,'draft');
 const saved=await c.call(body);assert.equal(saved.status,200);assert.equal(saved.body.workflow.updatedBy,'staff');
 const read=await c.call();assert.equal(read.body.posts[0].workflow.revision,1);assert.equal(read.body.posts[0].workflow.snsConfirmed.X,true);assert.equal(read.body.posts[0].xen,'private manuscript');assert.equal(c.doc.posts[0].workflow,undefined);assert.equal(read.cache,'private, no-store');
});
test('stale updates cannot overwrite another team member',async()=>{
 const c=setup();await c.call(body);assert.equal((await c.call({...body,stage:'draft'})).status,409);assert.equal((await c.call()).body.posts[0].workflow.stage,'reviewed');
});
test('unauthenticated users, nonstaff and foreign origins cannot save',async()=>{
 assert.equal((await setup(null).call(body)).status,401);assert.equal((await setup({id:'public',member:false}).call(body)).status,403);assert.equal((await setup().call(body,'https://foreign.test')).status,403);
});
test('reject unsafe images, invalid statuses, unknown dates and oversized bodies',async()=>{
 for(const url of ['javascript:alert(1)','data:image/png;base64,abc','http://example.com/a.png','https://user:pass@example.com/a'])assert.equal((await setup().call({...body,images:{X:url,IG:''}})).status,400);
 assert.equal((await setup().call({...body,stage:'published'})).status,400);assert.equal((await setup().call({...body,date:'2027-01-01'})).status,400);assert.equal((await setup().call({...body,extra:'x'.repeat(7000)})).status,413);
});

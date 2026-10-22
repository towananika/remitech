import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
let source=await readFile(new URL('../worker/chores-worker.js',import.meta.url),'utf8');
source=source.replace('import { DurableObject } from "cloudflare:workers";','class DurableObject {}').replace(/from "(\.\/[^"\n]+)"/g,(_,p)=>'from '+JSON.stringify(new URL('../worker/'+p,import.meta.url).href));
const {HubDO}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const png=await readFile(new URL('../favicon-32.png',import.meta.url));
function setup(actor={id:'staff',member:true}){
 const data=new Map(),objects=new Map(),events=[];let fail=false;
 const storage={get:async k=>structuredClone(data.get(k)),put:async(k,v)=>data.set(k,structuredClone(v))};storage.transaction=async fn=>fn(storage);
 const bucket={put:async(k,v)=>{if(fail)throw Error('storage failed');objects.set(k,new Uint8Array(v));},get:async k=>objects.has(k)?{body:objects.get(k)}:null,delete:async k=>objects.delete(k)};
 const hub=Object.create(HubDO.prototype);hub.ctx={storage};hub.env={RET_IMAGES:bucket,CHORES:{get:async()=>({posts:[{date:'2026-12-05'}]})}};hub.session=async()=>actor?{user:actor}:null;hub.publicUser=u=>u;hub.broadcast=t=>events.push(t);
 const get=async(pf)=>hub.internal('ret-image',new Request('https://test/internal/ret-image?date=2026-12-05'+(pf?'&platform='+pf:'')),'http://localhost:8899');
 const upload=async({revision=0,pf='X',bytes=png,type='image/png',name='投稿.png',origin='http://localhost:8899'}={})=>{const f=new FormData();f.append('file',new Blob([bytes],{type}),name);return hub.internal('ret-image',new Request('https://test/internal/ret-image?date=2026-12-05&platform='+pf+'&revision='+revision,{method:'POST',body:f}),origin);};
 return {get,upload,data,objects,events,hub,storage,fail:()=>{fail=true;}};
}
test('staff upload original bytes, receive private previews and replace without growing stored object count',async()=>{
 const c=setup();assert.equal((await (await c.get()).json()).images.X.revision,0);
 const r=await c.upload();assert.equal(r.status,200);const result=await r.json();assert.equal(result.image.name,'投稿.png');assert.equal(result.image.size,png.length);assert.equal(result.image.key,undefined);
 const image=await c.get('X');assert.equal(image.headers.get('Cache-Control'),'private, no-store');assert.equal(image.headers.get('X-Content-Type-Options'),'nosniff');assert.deepEqual(new Uint8Array(await image.arrayBuffer()),new Uint8Array(png));
 assert.equal((await c.get('IG')).status,404);assert.equal((await c.upload({revision:1})).status,200);assert.equal(c.objects.size,1);assert.equal(c.events.length,2);
});
test('anonymous and general members cannot list, download or upload; foreign origins cannot write',async()=>{
 for(const actor of [null,{id:'public',member:false}]){const c=setup(actor);assert.equal((await c.get()).status,actor?403:401);assert.equal((await c.get('X')).status,actor?403:401);assert.equal((await c.upload()).status,actor?403:401);}
 assert.equal((await setup().upload({origin:'https://foreign.test'})).status,403);
});
test('stale replacement is rejected and invalid or oversized files preserve existing image',async()=>{
 const c=setup();await c.upload();assert.equal((await c.upload()).status,409);
 assert.equal((await c.upload({revision:1,type:'image/svg+xml',bytes:'<svg/>'})).status,400);
 assert.equal((await c.upload({revision:1,type:'image/png',bytes:'not an image'})).status,400);
 assert.equal((await c.upload({revision:1,bytes:new Uint8Array(10*1024*1024+1)})).status,413);
 assert.equal(c.objects.size,1);assert.equal((await (await c.get()).json()).images.X.revision,1);
});
test('storage failures and a concurrent upload cannot replace the existing pointer',async()=>{
 const c=setup();await c.upload();const first=c.data.get('ret:image:2026-12-05:X');c.fail();await assert.rejects(c.upload({revision:1}));assert.deepEqual(c.data.get('ret:image:2026-12-05:X'),first);
 const d=setup();d.storage.transaction=async fn=>{d.data.set('ret:image:2026-12-05:X',{revision:1});return fn(d.storage);};assert.equal((await d.upload()).status,409);assert.equal(d.objects.size,0);
});
test('storage configuration and post dates are checked before uploading',async()=>{
 const c=setup();delete c.hub.env.RET_IMAGES;assert.equal((await c.upload()).status,503);
 const r=await setup().hub.internal('ret-image',new Request('https://test/internal/ret-image?date=2027-01-01'),'');assert.equal(r.status,400);
});

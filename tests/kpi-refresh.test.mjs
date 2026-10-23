import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const code = html.slice(html.indexOf('  var kmRefresh ='), html.indexOf('  function kpiManualHTML()'));
function setup(fetch) {
  const timers = [], nodes = {}, old = {rows:[{date:'2026-10-22',channel:'hiyoko',platform:'X',followers:255}]};
  const c = vm.createContext({fetch, kpi:old, tab:'kpi', t:k=>k,
    document:{getElementById:id=>nodes[id] ||= {}}, view:{addEventListener:()=>{}},
    fetchApi:()=>'/fetchreq', setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},
    localStorage:{setItem:()=>{}},renderKpi:()=>{},window:{scrollY:10,scrollTo:()=>{}}});
  vm.runInContext(code,c);
  return {c,timers,old,nodes};
}
const reqAt='2026-10-23T01:00:00Z';
const reply = j=>({ok:true,json:async()=>j});
test('refresh is idle until clicked; completed request loads fresh data only',async()=>{
  const calls=[];
  const {c}=setup(async(url,options)=>{calls.push([url,options]);
    if(options.method==='POST')return reply({reqAt,state:'pending'});
    if(url.startsWith('/fetchreq'))return reply({reqAt,state:'done'});
    return reply({updated:reqAt,rows:[],refreshSummary:{updated:4,warnings:1}});
  });
  assert.equal(calls.length,0);
  await c.kmRefreshStart();
  assert.equal(calls[0][0],'/fetchreq?scope=kpi');
  assert.equal(JSON.parse(calls[0][1].body).scope,'kpi');
  assert.equal(calls[2][1].cache,'no-store');
  assert.equal(c.kmRefresh.busy,false);
  assert.equal(c.kmRefresh.msg,'kmRefreshPartial');
});
test('double click requests once; running request keeps button disabled',async()=>{
  let posts=0;
  const {c,timers,nodes}=setup(async(url,o)=>{if(o.method==='POST'){posts++;return reply({reqAt});}return reply({reqAt,state:'running'});});
  await Promise.all([c.kmRefreshStart(),c.kmRefreshStart()]);
  assert.equal(posts,1);assert.equal(nodes.kmRefreshBtn.disabled,true);assert.equal(timers.length,1);
});
test('network and collector errors keep previous KPI values and allow retry',async()=>{
  for(const failure of ['network','collector']){
    const {c,old}=setup(async(url,o)=>{
      if(failure==='network')throw Error('offline');
      return reply(o.method==='POST'?{reqAt}:{reqAt,state:'error',msg:'failed'});
    });
    await c.kmRefreshStart();assert.equal(c.kpi,old);assert.equal(c.kmRefresh.busy,false);
  }
});
test('old published data is not falsely reported as updated',async()=>{
  const {c,old,timers}=setup(async(url,o)=>reply(o.method==='POST'?{reqAt}:url.startsWith('/fetchreq')?{reqAt,state:'done'}:{rows:[],updated:'2026-10-22T00:00:00Z'}));
  await c.kmRefreshStart();assert.equal(c.kpi,old);assert.equal(c.kmRefresh.busy,true);assert.equal(timers.length,1);
});
test('fresh read preserves a newer manual correction',async()=>{
  const {c}=setup(async()=>reply({rows:[{date:'2026-10-23',channel:'hiyoko',platform:'X',followers:255}],updated:reqAt}));
  c.kmRefresh.reqAt=reqAt;
  c.kpi.rows=[{date:'2026-10-23',channel:'hiyoko',platform:'X',followers:300,source:'manual',checkedAt:{followers:reqAt}}];
  await c.kmRefreshRead(0);assert.equal(c.kpi.rows[0].followers,300);
});

let worker=await readFile(new URL('../worker/chores-worker.js',import.meta.url),'utf8');
worker=worker.replace('import { DurableObject } from "cloudflare:workers";','class DurableObject {}');
worker=worker.replace(/from "(\.\/[^"\n]+)"/g,(_,path)=>'from '+JSON.stringify(new URL('../worker/'+path,import.meta.url).href));
const {HubDO}=await import('data:text/javascript;base64,'+Buffer.from(worker).toString('base64'));
test('KPI and post requests have independent queues, and repeated KPI requests deduplicate',async()=>{
  const data=new Map([['cfg:fetchreq',{state:'running',startAt:new Date().toISOString(),scope:'telegram'}]]);
  const hub=Object.create(HubDO.prototype);
  hub.ctx={storage:{get:async k=>data.get(k),put:async(k,v)=>data.set(k,v)}};hub.broadcast=()=>{};
  const request=()=>new Request('https://test/fetchreq?scope=kpi',{method:'POST',body:JSON.stringify({scope:'kpi'})});
  const first=await (await hub.fetchReq('/fetchreq',request(),'')).json();
  const second=await (await hub.fetchReq('/fetchreq',request(),'')).json();
  assert.equal(first.scope,'kpi');assert.equal(first.reqAt,second.reqAt);
  assert.equal(data.get('cfg:fetchreq').scope,'telegram');
  assert.equal(data.get('cfg:kpireq').state,'pending');
});

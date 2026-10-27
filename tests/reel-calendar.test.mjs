import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as R from '../reel-workflow.mjs';

test('calendar includes IG Story and uses shared booking states independently of IG',()=>{
  const source=readFileSync(new URL('../reel-editor.mjs',import.meta.url),'utf8');
  const start=source.indexOf('  function checkOverview()');
  const end=source.indexOf('  function render(){',start);
  const day=R.today();
  const context={R,calendarOffset:0,date:day,pf:'IGS',busy:false,online:true,
    member:()=>true,holidays:{},externalReviews:[],find:()=>({}),
    t:k=>k,e:s=>String(s),a:{lang:()=> 'ja',booked:(d,p)=>d===day&&p==='IGS',posted:()=>false}};
  const html=vm.runInNewContext(source.slice(start,end)+';checkOverview()',context);
  assert.match(html,/re-check-channel">IG Story/);
  assert.match(html,new RegExp(`data-re-check-date="${day}" data-re-check-platform="IGS"[^>]*data-publication="scheduled"`));
  assert.match(html,new RegExp(`data-re-check-date="${day}" data-re-check-platform="IG"[^>]*data-publication=""`));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../reel-workflow.mjs';

test('board search matches every term across Japanese, original and revised English',()=>{
  const post={parts:[{label:'Feed 1',ja:'小さな発見',en:'Original text'},{label:'Comment',ja:'質問',en:'Ask'}],noboParts:['Revised SCORE line','Ask']};
  const text=R.postSearchText(post,['2026-11-03','Weekly theme']);
  assert.ok(R.matchesQuery(text,'score 発見'));
  assert.ok(R.matchesQuery(text,'original'));
  assert.ok(R.matchesQuery(text,'２０２６-11'));
  assert.ok(!R.matchesQuery(text,'score missing'));
  assert.ok(R.matchesQuery('',''));
});
test('board pages hold ten posts and clamp out-of-range pages',()=>{
  const items=Array.from({length:23},(_,i)=>i);
  assert.deepEqual(R.pageOf(items,1).items,[0,1,2,3,4,5,6,7,8,9]);
  assert.deepEqual(R.pageOf(items,3),{page:3,pages:3,items:[20,21,22]});
  assert.equal(R.pageOf(items,9).page,3);assert.equal(R.pageOf([],0).pages,1);
  assert.deepEqual(R.pageNumbers(6,20),[1,null,4,5,6,7,8,null,20]);
  assert.deepEqual(R.pageNumbers(1,3),[1,2,3]);
});

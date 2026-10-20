import test from 'node:test';
import assert from 'node:assert/strict';
import {provisionAccount,ACCOUNT_SEED_KEY} from '../worker/provision-account.mjs';
function setup(seed){
 const data=new Map();let reads=0;
 const storage={get:async key=>structuredClone(data.get(key)),put:async(key,value)=>data.set(key,structuredClone(value))};
 storage.transaction=async fn=>fn(storage);
 return {data,hub:{ctx:{storage},env:{CHORES:{get:async key=>{assert.equal(key,ACCOUNT_SEED_KEY);reads++;return seed;}}}},reads:()=>reads};
}
const seed={version:1,id:'NOBO',salt:'a'.repeat(32),hash:'b'.repeat(64),iter:100000};
test('private invitation creates a staff account once with a password change reminder',async()=>{
 const c=setup(seed);await provisionAccount(c.hub);let user=c.data.get('u:nobo');
 assert.equal(user.id,'nobo');assert.equal(user.member,true);assert.equal(user.changePasswordSuggested,true);assert.equal(user.admin,undefined);
 user.hash='changed';c.data.set('u:nobo',user);await provisionAccount(c.hub);
 assert.equal(c.data.get('u:nobo').hash,'changed');assert.equal(c.reads(),1);
});
test('an existing account and role are never replaced',async()=>{
 const c=setup(seed);const user={id:'nobo',member:false,hash:'existing'};c.data.set('u:nobo',user);
 await provisionAccount(c.hub);assert.deepEqual(c.data.get('u:nobo'),user);
});
test('invalid invitation cannot create another account or store an invalid credential',async()=>{
 for(const bad of [{...seed,id:'someone-else'},{...seed,hash:'invalid'}]){
  const c=setup(bad);await assert.rejects(provisionAccount(c.hub));assert.equal(c.data.size,0);
 }
 const c=setup(null);await provisionAccount(c.hub);assert.equal(c.data.size,0);
});

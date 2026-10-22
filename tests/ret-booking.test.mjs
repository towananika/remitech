import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const weekend=source.slice(source.indexOf('  function bkRetWeekendBlocked('),source.indexOf('  function bkSetSlotState('));
const booking=source.slice(source.indexOf('  function retBookingSlot('),source.indexOf('  function retInternalHTML('));
function context({fail=false,other=false}={}){
 const data={newSlots:{},slots:{},memos:{}},writes=[];
 const c=vm.createContext({window:{scrollY:0,scrollTo:()=>{}},schedule:{slots:[]},bookRows:{groups:[{channel:'ret',rows:[{platforms:['X'],time:'09:00',label:'X'},{platforms:['IG'],time:'09:00',label:'IG'}]}]},
 retDoc:{posts:[{date:'2026-10-31',alternate:'2026-11-01'}]},retDate:'2026-10-31',retPlatform:'x',retBookChoices:{},retBookBusy:false,retBookReady:false,retBookMsg:'',bkLast:null,bkSrv:{},tab:'prep',filter:'ret',
 authUser:()=>({id:'staff',member:true}),bkGroupRows:g=>g.rows,slotCh:x=>x.channel,bookApi:()=>'/book',teamCode:()=>'',route:()=>{},renderBookKeep:()=>{},t:k=>k,
 fetch:async(url,options)=>{
  if(options.method==='POST'){const b=JSON.parse(options.body);writes.push(b);if(fail)return{ok:false,status:503};data[b.kind==='n'?'newSlots':b.kind==='m'?'memos':'slots'][b.key]=structuredClone(b.value);return{ok:true,json:async()=>({ok:true})};}
  if(other){data.newSlots['ret|2026-11-01|X|09:00']={date:'2026-11-01',channel:'ret',platform:'X',time:'09:00',scheduled:true};}
  return{ok:true,json:async()=>structuredClone(data)};
 }});
 c.bookApply=o=>{for(const [key,slot] of Object.entries(o.newSlots)){if(!c.schedule.slots.some(x=>`${x.channel}|${x.date}|${x.platform}|${x.time}`===key))c.schedule.slots.push(structuredClone(slot));}for(const [key,value] of Object.entries(o.slots)){const slot=c.schedule.slots.find(x=>`${x.channel}|${x.date}|${x.platform}|${x.time}`===key);if(slot)Object.assign(slot,value);}};
 vm.runInContext(weekend+booking,c);return{c,data,writes};
}
test('RET creates the booking-tab slot without leaking manuscripts, then cancels the same slot',async()=>{
 const {c,writes}=context();await c.retToggleBooking();assert.equal(writes.length,1);assert.equal(writes[0].key,'ret|2026-10-31|X|09:00');assert.equal(writes[0].kind,'n');assert.deepEqual(writes[0].value.text,{ja:'',en:'',ko:''});assert.equal(c.retBooked('2026-10-31','X'),true);assert.equal(c.retBooked('2026-10-31','IG'),false);
 await c.retToggleBooking();assert.equal(writes[1].kind,'s');assert.equal(writes[1].value.scheduled,false);assert.equal(c.retBooked('2026-10-31','X'),false);
});
test('failed shared saves leave the local reservation unbooked',async()=>{
 const {c}=context({fail:true});await c.retToggleBooking();assert.equal(c.retBooked('2026-10-31','X'),false);assert.equal(c.retBookBusy,false);assert.equal(c.retBookMsg,'authNet');assert.equal(c.schedule.slots.length,0);
});
test('fresh alternate-day reservations block writes and select the already booked date',async()=>{
 const {c,writes}=context({other:true});await c.retToggleBooking();assert.equal(writes.length,0);assert.equal(c.retBookChoices['2026-10-31|X'],'2026-11-01');assert.equal(c.retBooked('2026-11-01','X'),true);
});
test('duplicate clicks share one save and non-staff cannot book from RET',async()=>{
 const {c,writes}=context();await Promise.all([c.retToggleBooking(),c.retToggleBooking()]);assert.equal(writes.length,1);
 c.authUser=()=>({member:false});await c.retToggleBooking();assert.equal(writes.length,1);
});

test('legacy bookings at 12:00 are preserved and cannot be silently duplicated at 09:00',async()=>{
 const {c,data,writes}=context();data.newSlots['ret|2026-10-31|X|12:00']={date:'2026-10-31',channel:'ret',platform:'X',time:'12:00',scheduled:true};
 await c.retToggleBooking();assert.equal(writes.length,0);assert.equal(c.retBookingSlot('2026-10-31','X').legacy.time,'12:00');assert.equal(c.retBooked('2026-10-31','X'),false);
});

test('approval waiting is independent per date/platform and never changes booking slots',async()=>{
 const {c,data,writes}=context();c.retBookReady=true;
 await c.retToggleApproval('X');assert.equal(c.retApprovalPending('2026-10-31','X'),true);assert.equal(c.retApprovalPending('2026-11-07','X'),false);assert.equal(c.schedule.slots.length,0);
 assert.equal(writes[0].kind,'m');assert.equal(writes[0].key,'ret-approval|2026-10-31|X');assert.equal(data.memos[writes[0].key],'pending');
 assert.equal(c.retApprovalPending('2026-10-31','IG'),false);await c.retToggleApproval('IG');assert.equal(c.retApprovalPending('2026-10-31','IG'),true);
 await c.retToggleApproval('X');assert.equal(c.retApprovalPending('2026-10-31','X'),false);assert.equal(writes[2].value,'');assert.equal(c.retApprovalPending('2026-10-31','IG'),true);
});
test('approval save failure preserves state, duplicate clicks and nonstaff cannot write',async()=>{
 const failed=context({fail:true});failed.c.retBookReady=true;await failed.c.retToggleApproval('X');assert.equal(failed.c.retApprovalPending('2026-10-31','X'),false);assert.equal(failed.c.retBookBusy,false);
 const {c,writes}=context();c.retBookReady=true;await Promise.all([c.retToggleApproval('X'),c.retToggleApproval('X')]);assert.equal(writes.length,1);
 c.authUser=()=>({member:false});await c.retToggleApproval('X');assert.equal(writes.length,1);
});

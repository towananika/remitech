// Account invitations are installed privately by the deployment administrator.
// The repository never contains password hashes or invitation payloads.
export const ACCOUNT_SEED_KEY = 'seed:account:nobo:v1';
const MARKER = 'meta:account:nobo:v1';
export async function provisionAccount(hub) {
  if(await hub.ctx.storage.get(MARKER))return;
  const seed=await hub.env.CHORES?.get(ACCOUNT_SEED_KEY,'json');
  if(!seed || seed.version!==1)return;
  if(typeof seed.id!=='string'||seed.id.trim().toLowerCase()!=='nobo' ||
     !/^[0-9a-f]{32}$/.test(seed.salt)||!/^[0-9a-f]{64}$/.test(seed.hash)||seed.iter!==100000)throw new Error('invalid-account-invitation');
  await hub.ctx.storage.transaction(async tx=>{
    if(await tx.get(MARKER))return;
    const existing=await tx.get('u:nobo');
    if(!existing)await tx.put('u:nobo',{id:'nobo',salt:seed.salt,hash:seed.hash,iter:seed.iter,created:new Date().toISOString(),member:true,changePasswordSuggested:true});
    await tx.put(MARKER,{at:new Date().toISOString(),created:!existing});
  });
}

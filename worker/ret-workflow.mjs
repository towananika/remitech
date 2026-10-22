// Shared preparation metadata; manuscripts remain in private KV.
export function safeImageURL(value) {
  if (value === '') return '';
  if (typeof value !== 'string' || value.length > 2000) return null;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : null; } catch (_) { return null; }
}
export async function retWorkflow(hub, request, origin, doc, send, user) {
  const reply = (body, status = 200) => send(body, status, origin, {'Cache-Control':'private, no-store'});
  if (request.method === 'GET') {
    const values = await hub.ctx.storage.list({prefix:'ret:workflow:'});
    return reply({...doc, posts:doc.posts.map(p => ({...p, workflow:values.get('ret:workflow:'+p.date) || {revision:0,stage:'draft',images:{X:'',IG:''},snsConfirmed:{X:false,IG:false}}}))});
  }
  if (request.method !== 'POST') return reply({error:'method'},405);
  if (origin && !['https://towananika.github.io','http://localhost:8899','http://127.0.0.1:8899'].includes(origin)) return reply({error:'origin'},403);
  const text = await request.text();
  if (text.length > 6000) return reply({error:'too-large'},413);
  let b; try { b = JSON.parse(text); } catch (_) { return reply({error:'bad-json'},400); }
  if (!b || !doc.posts.some(p=>p.date===b.date) || !Number.isInteger(b.revision) || b.revision<0 || !['draft','reviewed'].includes(b.stage)) return reply({error:'invalid'},400);
  const images = {}, snsConfirmed = {};
  for (const pf of ['X','IG']) {
    const url = safeImageURL(b.images?.[pf]);
    if (url === null || typeof b.snsConfirmed?.[pf] !== 'boolean') return reply({error:'invalid'},400);
    images[pf] = url; snsConfirmed[pf] = b.snsConfirmed[pf];
  }
  const result = await hub.ctx.storage.transaction(async tx => {
    const key = 'ret:workflow:'+b.date, current = await tx.get(key);
    if ((current?.revision || 0) !== b.revision) return {error:'conflict'};
    const workflow = {revision:b.revision+1,stage:b.stage,images,snsConfirmed,updatedAt:new Date().toISOString(),updatedBy:user.id};
    await tx.put(key,workflow); return {ok:true,workflow};
  });
  return reply(result,result.error ? 409 : 200);
}

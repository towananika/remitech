const MAX_IMAGE = 10 * 1024 * 1024;
const ALLOWED_ORIGINS = ['https://towananika.github.io','http://localhost:8899','http://127.0.0.1:8899'];
function imageType(bytes) {
  if (bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return 'image/png';
  if (bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return 'image/jpeg';
  if (bytes.length>=12 && new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP') return 'image/webp';
  return null;
}
function publicMeta(m) {
  if (!m) return {revision:0};
  const {revision,name,size,type,updatedAt,updatedBy}=m;
  return {revision,name,size,type,updatedAt,updatedBy};
}
export async function retImages(hub, request, origin, doc, user, send, cors) {
  const reply=(body,status=200)=>send(body,status,origin,{'Cache-Control':'private, no-store'});
  const url=new URL(request.url), date=url.searchParams.get('date'), pf=url.searchParams.get('platform');
  if (!doc.posts?.some(p=>p.date===date)) return reply({error:'date'},400);
  if (!hub.env.RET_IMAGES) return reply({error:'storage-not-configured'},503);
  if (request.method==='GET' && !pf) {
    const images={};for (const p of ['X','IG']) images[p]=publicMeta(await hub.ctx.storage.get('ret:image:'+date+':'+p));
    return reply({images});
  }
  if (!['X','IG'].includes(pf)) return reply({error:'platform'},400);
  const pointer='ret:image:'+date+':'+pf;
  if (request.method==='GET') {
    const meta=await hub.ctx.storage.get(pointer);if (!meta) return reply({error:'none'},404);
    const object=await hub.env.RET_IMAGES.get(meta.key);if (!object) return reply({error:'none'},404);
    return new Response(object.body,{headers:{...cors(origin),'Content-Type':meta.type,'Content-Length':String(meta.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':(url.searchParams.get('download')==='1'?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(meta.name)}});
  }
  if (request.method!=='POST') return reply({error:'method'},405);
  if (origin && !ALLOWED_ORIGINS.includes(origin)) return reply({error:'origin'},403);
  const revision=Number(url.searchParams.get('revision'));
  if (!url.searchParams.has('revision') || !Number.isInteger(revision) || revision<0) return reply({error:'revision'},400);
  const current=await hub.ctx.storage.get(pointer);
  if ((current?.revision||0)!==revision) return reply({error:'conflict'},409);
  if (Number(request.headers.get('Content-Length'))>MAX_IMAGE+8192) return reply({error:'too-large'},413);
  // Bound the multipart body even when Content-Length is absent or incorrect.
  const reader=request.body?.getReader();if (!reader) return reply({error:'file'},400);
  const chunks=[];let size=0;
  while (true) {const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_IMAGE+8192){await reader.cancel();return reply({error:'too-large'},413);}chunks.push(part.value);}
  const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  let form;try {form=await new Response(body,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();}catch(_){return reply({error:'file'},400);}
  const file=form.get('file');if (!file || typeof file.arrayBuffer!=='function' || !file.size) return reply({error:'file'},400);
  if (file.size>MAX_IMAGE) return reply({error:'too-large'},413);
  const bytes=new Uint8Array(await file.arrayBuffer()), type=imageType(bytes);
  if (!type || type!==file.type) return reply({error:'image-type'},400);
  const name=String(file.name||'image').split(/[\\/]/).pop().replace(/[\r\n\x00-\x1f]/g,'').slice(0,160)||'image';
  const key='ret/'+date+'/'+pf+'/'+crypto.randomUUID();
  const meta={key,revision:revision+1,name,size:file.size,type,updatedAt:new Date().toISOString(),updatedBy:user.id};
  await hub.env.RET_IMAGES.put(key,bytes,{httpMetadata:{contentType:type}});
  let saved;
  try {
    saved=await hub.ctx.storage.transaction(async tx=>{const latest=await tx.get(pointer);if((latest?.revision||0)!==revision)return false;await tx.put(pointer,meta);return true;});
  } catch(e) {await hub.env.RET_IMAGES.delete(key);throw e;}
  if(!saved){await hub.env.RET_IMAGES.delete(key);return reply({error:'conflict'},409);}
  if(current?.key){try{await hub.env.RET_IMAGES.delete(current.key);}catch(_){/* Keep the successful replacement usable if cleanup fails. */}}
  hub.broadcast('ret-image');
  return reply({ok:true,image:publicMeta(meta)});
}

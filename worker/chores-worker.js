// REMITECH HUB — いいね作業のチェックを、全員で共有する置き場
//
// なぜ要るか: これまでは GitHub の鍵を入れた端末だけが保存でき、
// 鍵のない端末で押した印はその端末にしか残らなかった。
// ここに置けば、合言葉を知っている人の端末ならどれからでも書け、誰でも読める。
//
// 置くもの: 日ごとの「済み」の印だけ（例 {"hiyoko|X|2": true}）。個人情報は持たない。
//
// デプロイ（このフォルダで）:
//   1. npx wrangler kv namespace create CHORES   → 出た id を wrangler.toml に貼る
//   2. 合言葉を入れる: set-team-code.ps1 を実行（合言葉は画面にもファイルにも残さない）
//   3. npx wrangler deploy
//
// 読む:  GET  /chores            → { done: { "2026-09-14": { id: true, ... }, ... } }（直近60日）
// 書く:  POST /chores  { date, id, on, code }

const DAYS_KEPT = 60;
const MAX_BODY = 1024;
const ALLOWED = ["https://towananika.github.io", "http://localhost:8899", "http://127.0.0.1:8899"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
    if (url.pathname !== "/chores") return json({ ok: true, service: "remitech-chores" }, 200, origin);

    if (request.method === "GET") return list(env, origin);
    if (request.method === "POST") return save(request, env, origin);
    return json({ error: "method" }, 405, origin);
  },
};

async function list(env, origin) {
  const out = {};
  const keys = await env.CHORES.list({ prefix: "d:" });
  const recent = keys.keys.map((k) => k.name).sort().slice(-DAYS_KEPT);
  await Promise.all(recent.map(async (name) => {
    const v = await env.CHORES.get(name, "json");
    if (v && Object.keys(v).length) out[name.slice(2)] = v;
  }));
  return json({ done: out }, 200, origin, { "Cache-Control": "no-store" });
}

async function save(request, env, origin) {
  // 合言葉が設定されていないうちは、誰にも書かせない
  if (!env.TEAM_CODE) return json({ error: "not-configured" }, 503, origin);

  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: "too-large" }, 413, origin);
  let b;
  try { b = JSON.parse(text); } catch (e) { return json({ error: "bad-json" }, 400, origin); }

  if (!b || typeof b.code !== "string" || !safeEqual(b.code, env.TEAM_CODE)) {
    return json({ error: "code" }, 403, origin);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) return json({ error: "date" }, 400, origin);
  if (!/^[A-Za-z0-9|_:.-]{1,40}$/.test(b.id || "")) return json({ error: "id" }, 400, origin);

  // 日ごとに別の鍵にして、違う日を同時に押しても上書きし合わないようにする
  const key = "d:" + b.date;
  const day = (await env.CHORES.get(key, "json")) || {};
  if (b.on) day[b.id] = true; else delete day[b.id];
  await env.CHORES.put(key, JSON.stringify(day));
  return json({ ok: true, date: b.date, day }, 200, origin);
}

// 合言葉の比較で、一致した文字数が時間差から漏れないようにする
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : ALLOWED[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(obj, status, origin, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors(origin), extra || {}),
  });
}

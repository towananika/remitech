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
    if (url.pathname === "/book") {
      if (request.method === "GET") return bookList(env, origin);
      if (request.method === "POST") return bookSave(request, env, origin);
      return json({ error: "method" }, 405, origin);
    }
    if (url.pathname !== "/chores") return json({ ok: true, service: "remitech-chores" }, 200, origin);

    if (request.method === "GET") return list(env, origin);
    if (request.method === "POST") return save(request, env, origin);
    return json({ error: "method" }, 405, origin);
  },
};

// ================= 予約タブ =================
// schedule.json を土台に、予約タブで押した変更だけをここに置く。どの端末も読み込んで上に重ねる。
// 1つの印ごとに別の鍵にして、違うマスを同時に押しても上書きし合わないようにする。
//   bk:h:<日付>        休日 true/false
//   bk:a:<日付>        担当者 "Suha" など（空文字は「なし」）
//   bk:s:<枠の鍵>      枠の状態 { scheduled, reply, replyAt, status }
//   bk:n:<枠の鍵>      予約タブで作った枠（枠そのもの）
const BOOK_KINDS = { h: 1, a: 1, s: 1, n: 1 };
const MAX_BOOK_BODY = 4096;

async function bookList(env, origin) {
  const out = { holidays: {}, assignees: {}, slots: {}, newSlots: {} };
  let cursor;
  do {
    const page = await env.CHORES.list({ prefix: "bk:", cursor });
    await Promise.all(page.keys.map(async (k) => {
      const v = await env.CHORES.get(k.name, "json");
      const kind = k.name.slice(3, 4), key = k.name.slice(5);
      if (kind === "h") out.holidays[key] = !!v;
      else if (kind === "a") out.assignees[key] = typeof v === "string" ? v : "";
      else if (kind === "s" && v) out.slots[key] = v;
      else if (kind === "n" && v) out.newSlots[key] = v;
    }));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return json(out, 200, origin, { "Cache-Control": "no-store" });
}

async function bookSave(request, env, origin) {
  if (!env.TEAM_CODE) return json({ error: "not-configured" }, 503, origin);
  const text = await request.text();
  if (text.length > MAX_BOOK_BODY) return json({ error: "too-large" }, 413, origin);
  let b;
  try { b = JSON.parse(text); } catch (e) { return json({ error: "bad-json" }, 400, origin); }
  if (!b || typeof b.code !== "string" || !safeEqual(b.code, env.TEAM_CODE)) return json({ error: "code" }, 403, origin);
  if (!BOOK_KINDS[b.kind]) return json({ error: "kind" }, 400, origin);
  if (typeof b.key !== "string" || !/^[A-Za-z0-9|_:.\-]{1,80}$/.test(b.key)) return json({ error: "key" }, 400, origin);

  let value = b.value;
  if (b.kind === "h") value = !!value;
  else if (b.kind === "a") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.key)) return json({ error: "key" }, 400, origin);
    value = typeof value === "string" ? value.slice(0, 20) : "";
  } else if (b.kind === "s") {
    if (!value || typeof value !== "object") return json({ error: "value" }, 400, origin);
    value = {
      scheduled: !!value.scheduled, reply: !!value.reply,
      replyAt: typeof value.replyAt === "string" ? value.replyAt.slice(0, 40) : "",
      status: value.status === "preparing" ? "preparing" : "",
    };
  } else if (b.kind === "n") {
    if (!value || typeof value !== "object" || typeof value.date !== "string") return json({ error: "value" }, 400, origin);
  }
  if (b.kind === "h" && !/^\d{4}-\d{2}-\d{2}$/.test(b.key)) return json({ error: "key" }, 400, origin);
  await env.CHORES.put("bk:" + b.kind + ":" + b.key, JSON.stringify(value));
  return json({ ok: true }, 200, origin);
}

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

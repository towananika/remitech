// REMITECH HUB — いいね作業・予約タブの印を、全員で共有する置き場（リアルタイム）
//
// しくみ（2026-09-14）:
//   すべてのデータを1つの Durable Object（HubDO "main"）に置く。書き込みはここを通るので順番が乱れない。
//   画面は /ws に WebSocket でつないでおく。誰かが書いたら、つないでいる画面ぜんぶに「変わった」を送る。
//   画面はその知らせを受けて、いつもの GET で読み直す（読み書きの形は以前と同じ）。
//   以前の置き場（KV: CHORES）の中身は、最初に動いたときに1回だけ写す。
//
// 置くもの（鍵の形は以前の KV と同じ）:
//   d:<日付>           その日のいいね作業の済み { id: true }
//   bk:h:<日付>        休日 true/false
//   bk:a:<日付>        担当者（空文字は「なし」）
//   bk:s:<枠の鍵>      枠の状態 { scheduled, reply, replyAt, status }
//   bk:n:<枠の鍵>      予約タブで作った枠
//   bk:t:<日付>|<チャンネル>  Telegram で共有済み true/false
//   cfg:codehash       画面で変えた編集用パスワードのハッシュ { salt, hash, at }
//   rl:<IP>            パスワードの失敗回数 { n, exp }
//
// 読む:  GET  /chores → { done }   GET /book → { holidays, assignees, slots, newSlots }
// 書く:  POST /chores { date, id, on, code }   POST /book { kind, key, value, code }   POST /code { current, next }
// 知らせ: GET /ws（WebSocket）→ {"t":"chores"} / {"t":"book"}

import { DurableObject } from "cloudflare:workers";

const DAYS_KEPT = 60;
const MAX_BODY = 1024;
const MAX_BOOK_BODY = 4096;
const BOOK_KINDS = { h: 1, a: 1, s: 1, n: 1, t: 1 };
const ALLOWED = ["https://towananika.github.io", "http://localhost:8899", "http://127.0.0.1:8899"];
const FAIL_LIMIT = 5;                 // 同じ IP から 1時間に 5回まちがえたら
const FAIL_WINDOW = 60 * 60;          // 1時間、どの書き込みもできない（正しいパスワードでも）

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
    const url = new URL(request.url);
    if (!["/chores", "/book", "/code", "/ws"].includes(url.pathname)) {
      return json({ ok: true, service: "remitech-chores" }, 200, origin);
    }
    const stub = env.HUB.get(env.HUB.idFromName("main"));
    return stub.fetch(request);
  },
};

export class HubDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.migrated = false;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    await this.migrateOnce();

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "websocket" }, 426, origin);
      if (origin && !ALLOWED.includes(origin)) return json({ error: "origin" }, 403, origin);
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (url.pathname === "/code" && request.method === "POST") return this.changeCode(request, origin);
    if (url.pathname === "/book") {
      if (request.method === "GET") return this.bookList(origin);
      if (request.method === "POST") return this.bookSave(request, origin);
      return json({ error: "method" }, 405, origin);
    }
    if (request.method === "GET") return this.list(origin);
    if (request.method === "POST") return this.save(request, origin);
    return json({ error: "method" }, 405, origin);
  }

  // ---- WebSocket ----
  async webSocketMessage(ws, message) {
    if (message === "ping") { try { ws.send("pong"); } catch (e) {} }
  }
  async webSocketClose(ws, code) {
    try { ws.close(code, "bye"); } catch (e) {}
  }
  broadcast(t) {
    const msg = JSON.stringify({ t });
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch (e) {} }
  }

  // ---- 以前の KV の中身を、1回だけ写す ----
  async migrateOnce() {
    if (this.migrated) return;
    if (await this.ctx.storage.get("meta:migrated")) { this.migrated = true; return; }
    if (this.env.CHORES) {
      for (const prefix of ["d:", "bk:", "cfg:"]) {
        let cursor;
        do {
          const page = await this.env.CHORES.list({ prefix, cursor });
          for (const k of page.keys) {
            const v = await this.env.CHORES.get(k.name, "json");
            if (v !== null && v !== undefined) await this.ctx.storage.put(k.name, v);
          }
          cursor = page.list_complete ? undefined : page.cursor;
        } while (cursor);
      }
    }
    await this.ctx.storage.put("meta:migrated", new Date().toISOString());
    this.migrated = true;
  }

  // ---- いいね作業 ----
  async list(origin) {
    const all = await this.ctx.storage.list({ prefix: "d:" });
    const names = [...all.keys()].sort().slice(-DAYS_KEPT);
    const out = {};
    for (const name of names) {
      const v = all.get(name);
      if (v && Object.keys(v).length) out[name.slice(2)] = v;
    }
    return json({ done: out }, 200, origin, { "Cache-Control": "no-store" });
  }

  async save(request, origin) {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: "too-large" }, 413, origin);
    let b;
    try { b = JSON.parse(text); } catch (e) { return json({ error: "bad-json" }, 400, origin); }
    if (!b) return json({ error: "bad-json" }, 400, origin);
    const denied = await this.checkCode(request, origin, b);
    if (denied) return denied;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")) return json({ error: "date" }, 400, origin);
    if (!/^[A-Za-z0-9|_:.-]{1,40}$/.test(b.id || "")) return json({ error: "id" }, 400, origin);
    const key = "d:" + b.date;
    const day = (await this.ctx.storage.get(key)) || {};
    if (b.on) day[b.id] = true; else delete day[b.id];
    await this.ctx.storage.put(key, day);
    this.broadcast("chores");
    return json({ ok: true, date: b.date, day }, 200, origin);
  }

  // ---- 予約タブ ----
  async bookList(origin) {
    const out = { holidays: {}, assignees: {}, slots: {}, newSlots: {}, telegram: {} };
    const all = await this.ctx.storage.list({ prefix: "bk:" });
    for (const [name, v] of all) {
      const kind = name.slice(3, 4), key = name.slice(5);
      if (kind === "h") out.holidays[key] = !!v;
      else if (kind === "a") out.assignees[key] = typeof v === "string" ? v : "";
      else if (kind === "s" && v) out.slots[key] = v;
      else if (kind === "n" && v) out.newSlots[key] = v;
      else if (kind === "t") out.telegram[key] = !!v;
    }
    return json(out, 200, origin, { "Cache-Control": "no-store" });
  }

  async bookSave(request, origin) {
    const text = await request.text();
    if (text.length > MAX_BOOK_BODY) return json({ error: "too-large" }, 413, origin);
    let b;
    try { b = JSON.parse(text); } catch (e) { return json({ error: "bad-json" }, 400, origin); }
    if (!b) return json({ error: "bad-json" }, 400, origin);
    const denied = await this.checkCode(request, origin, b);
    if (denied) return denied;
    if (!BOOK_KINDS[b.kind]) return json({ error: "kind" }, 400, origin);
    if (typeof b.key !== "string" || !/^[A-Za-z0-9|_:.\-]{1,80}$/.test(b.key)) return json({ error: "key" }, 400, origin);

    let value = b.value;
    if (b.kind === "h") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.key)) return json({ error: "key" }, 400, origin);
      value = !!value;
    } else if (b.kind === "a") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.key)) return json({ error: "key" }, 400, origin);
      value = typeof value === "string" ? value.slice(0, 20) : "";
    } else if (b.kind === "s") {
      if (!value || typeof value !== "object") return json({ error: "value" }, 400, origin);
      value = {
        scheduled: !!value.scheduled, reply: !!value.reply,
        replyAt: typeof value.replyAt === "string" ? value.replyAt.slice(0, 40) : "",
        status: value.status === "preparing" ? "preparing" : "",
      };
    } else if (b.kind === "t") {
      if (!/^\d{4}-\d{2}-\d{2}\|[a-z0-9_-]{1,30}$/.test(b.key)) return json({ error: "key" }, 400, origin);
      value = !!value;
    } else if (b.kind === "n") {
      if (!value || typeof value !== "object" || typeof value.date !== "string") return json({ error: "value" }, 400, origin);
    }
    await this.ctx.storage.put("bk:" + b.kind + ":" + b.key, value);
    this.broadcast("book");
    return json({ ok: true }, 200, origin);
  }

  // ---- パスワード ----
  async checkCode(request, origin, b) {
    const stored = await this.ctx.storage.get("cfg:codehash");
    if (!stored && !this.env.TEAM_CODE) return null;          // パスワードなしで運用中
    const ip = clientIp(request);
    if (await this.isBlocked(ip)) return json({ error: "too-many" }, 429, origin, { "Retry-After": String(FAIL_WINDOW) });
    if (typeof b.code === "string" && await this.codeMatches(b.code, stored)) return null;
    const n = await this.countFail(ip);
    if (n >= FAIL_LIMIT) return json({ error: "too-many" }, 429, origin, { "Retry-After": String(FAIL_WINDOW) });
    return json({ error: "code" }, 403, origin);
  }
  async isBlocked(ip) {
    const r = await this.ctx.storage.get("rl:" + ip);
    if (!r) return false;
    if (r.exp < Date.now()) { await this.ctx.storage.delete("rl:" + ip); return false; }
    return r.n >= FAIL_LIMIT;
  }
  async countFail(ip) {
    const now = Date.now();
    const r = await this.ctx.storage.get("rl:" + ip);
    const cur = r && r.exp > now ? r : { n: 0, exp: now + FAIL_WINDOW * 1000 };
    cur.n += 1;
    await this.ctx.storage.put("rl:" + ip, cur);
    return cur.n;
  }
  async codeMatches(code, stored) {
    if (stored && stored.salt && stored.hash) return safeEqual(await sha256Hex(stored.salt + code), stored.hash);
    return !!this.env.TEAM_CODE && safeEqual(code, this.env.TEAM_CODE);
  }
  // 最初のパスワードはスクリプト（wrangler secret TEAM_CODE）でだけ。画面からは今のパスワードを知っている人だけが変えられる
  async changeCode(request, origin) {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ error: "too-large" }, 413, origin);
    let b;
    try { b = JSON.parse(text); } catch (e) { return json({ error: "bad-json" }, 400, origin); }
    if (!b || typeof b.next !== "string") return json({ error: "bad-json" }, 400, origin);
    const stored = await this.ctx.storage.get("cfg:codehash");
    if (!stored && !this.env.TEAM_CODE) return json({ error: "no-password" }, 409, origin);
    const denied = await this.checkCode(request, origin, { code: b.current });
    if (denied) return denied;
    if (b.next.length < 8 || b.next.length > 64) return json({ error: "length" }, 400, origin);
    const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, "0")).join("");
    await this.ctx.storage.put("cfg:codehash", { salt, hash: await sha256Hex(salt + b.next), at: new Date().toISOString() });
    return json({ ok: true }, 200, origin);
  }
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "local";
}
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
// パスワードの比較で、一致した文字数が時間差から漏れないようにする
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

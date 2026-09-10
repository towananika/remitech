/**
 * REMITECH HUB の画像・動画置き場。
 *
 * 置いてあるページ（GitHub Pages）はファイルを書けないので、ここが受け口になる。
 * 読むのは誰でもよい（投稿に使う画像なので、いずれ公開される）。
 * 書くのは合言葉を知っている人だけ。合言葉は端末に入れてもらう。
 *
 *   PUT  /f/<key>   合言葉が要る。中身をそのまま置く
 *   GET  /f/<key>   誰でも読める
 *   DELETE /f/<key> 合言葉が要る
 *   GET  /list      合言葉が要る。置いてあるものの一覧
 */

const ALLOW_ORIGIN = "https://towananika.github.io";
const MAX_BYTES = 100 * 1024 * 1024;          // 1本100MBまで。動画を想定
const OK_TYPES = /^(image|video)\//;

function cors(extra) {
  return Object.assign({
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
  }, extra || {});
}

// 時間を測られても合言葉が漏れないように、長さも中身も一定の手順で比べる
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

function authed(req, env) {
  const h = req.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  return env.UPLOAD_TOKEN && safeEqual(token, env.UPLOAD_TOKEN);
}

// 鍵に使ってよい形だけ通す（.. や / で外へ出られないように）
function cleanKey(raw) {
  const k = decodeURIComponent(raw || "");
  if (!k || k.length > 200) return null;
  if (!/^[A-Za-z0-9._|\-]+$/.test(k)) return null;
  return k;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

    if (url.pathname === "/list") {
      if (!authed(req, env)) {
        await new Promise((r) => setTimeout(r, 700));   // 総当たりを遅くする
        return new Response("no", { status: 401, headers: cors() });
      }
      const out = await env.MEDIA.list({ limit: 1000 });
      const items = out.objects.map((o) => ({
        key: o.key, size: o.size, uploaded: o.uploaded,
        type: (o.httpMetadata && o.httpMetadata.contentType) || "",
      }));
      return new Response(JSON.stringify({ items }), {
        headers: cors({ "Content-Type": "application/json" }),
      });
    }

    if (!url.pathname.startsWith("/f/")) {
      return new Response("REMITECH media", { headers: cors() });
    }

    const key = cleanKey(url.pathname.slice(3));
    if (!key) return new Response("bad key", { status: 400, headers: cors() });

    if (req.method === "GET") {
      const obj = await env.MEDIA.get(key);
      if (!obj) return new Response("not found", { status: 404, headers: cors() });
      const h = cors({
        "Content-Type": (obj.httpMetadata && obj.httpMetadata.contentType) || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": obj.httpEtag,
      });
      return new Response(obj.body, { headers: h });
    }

    if (!authed(req, env)) {
      await new Promise((r) => setTimeout(r, 700));
      return new Response("no", { status: 401, headers: cors() });
    }

    if (req.method === "PUT") {
      const type = req.headers.get("Content-Type") || "";
      if (!OK_TYPES.test(type)) {
        return new Response("type", { status: 415, headers: cors() });
      }
      const len = Number(req.headers.get("Content-Length") || 0);
      if (len > MAX_BYTES) return new Response("too big", { status: 413, headers: cors() });

      await env.MEDIA.put(key, req.body, { httpMetadata: { contentType: type } });
      return new Response(JSON.stringify({ ok: true, key: key, url: url.origin + "/f/" + encodeURIComponent(key) }), {
        headers: cors({ "Content-Type": "application/json" }),
      });
    }

    if (req.method === "DELETE") {
      await env.MEDIA.delete(key);
      return new Response(JSON.stringify({ ok: true }), {
        headers: cors({ "Content-Type": "application/json" }),
      });
    }

    return new Response("method", { status: 405, headers: cors() });
  },
};

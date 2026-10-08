// 投稿タブ用: アプリ内ブラウザで X のプロフィール（例 https://x.com/HiyokoGlobal）を開いて、この中身を実行する。
// 返す: [{url, at, text, replies, reposts, likes, views, pinned}]  → tools/posts_fetch.py --merge で posts_check.json に足す
// ログインなしで見えるのは新しい方から5件ほど。投稿時刻は投稿IDから計算する（X の ID は作られた時刻を含む）
// 2026-10-08 の X の画面（韓国語表示）に合わせてある。見た目が変わったら aria-label と本文の要素を見直す
(function () {
  function num(s) {
    s = String(s || "").replace(/,/g, "").trim();
    if (!s) return 0;
    var m = /^([\d.]+)\s*(천|만|K|M|k|m|千|万)?$/.exec(s);
    if (!m) return null;
    var k = { "천": 1e3, "千": 1e3, "K": 1e3, "k": 1e3, "만": 1e4, "万": 1e4, "M": 1e6, "m": 1e6 }[m[2]] || 1;
    return Math.round(parseFloat(m[1]) * k);
  }
  function cnt(a, labels) {
    for (var i = 0; i < labels.length; i++) {
      var e = a.querySelector('[aria-label="' + labels[i] + '"]');
      if (e) return num(e.innerText);
    }
    return null;
  }
  return [].slice.call(document.querySelectorAll("article")).map(function (a) {
    var st = [].slice.call(a.querySelectorAll('a[href*="/status/"]')).map(function (x) { return x.getAttribute("href"); })
      .filter(function (h) { return /^\/\w+\/status\/\d+$/.test(h); })[0];
    if (!st) return null;
    var id = st.split("/").pop();
    var at = new Date(Number(BigInt(id) >> 22n) + 1288834974657).toISOString();
    var body = a.querySelector('div[dir="auto"].text-body') || a.querySelector('div[dir="auto"]');
    return {
      url: "https://x.com" + st, at: at, text: body ? body.innerText.trim() : "",
      replies: cnt(a, ["답글", "Reply", "返信"]), reposts: cnt(a, ["재게시", "Repost", "リポスト"]),
      likes: cnt(a, ["마음에 들어요", "Like", "いいね"]), views: cnt(a, ["조회수", "View", "表示"]), comments: cnt(a, ["답글", "Reply", "返信"]),
      pinned: /고정됨|Pinned|固定/.test(a.innerText.slice(0, 60)),
    };
  }).filter(Boolean);
})();

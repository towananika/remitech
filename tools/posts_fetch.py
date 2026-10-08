"""投稿タブ用: 各アカウントの最近の投稿（リンク・投稿時刻・本文・ビュー・いいね・コメント）を posts_check.json に集める。

2026-10-08 Hibiki指定（「予約したフィードが投稿されているかを確かめたい」）。
  自動（毎日 12:00、kpi_daily.py から）:
    Instagram : ヘッドレスブラウザでプロフィール → 投稿ページの og:description（いいね・コメント・日付・本文）と time
    YouTube   : 動画ページの HTML（公開日時・再生数・いいね。コメント数は取れない）
  頼んだとき（「投稿確認して」）: X・Facebook・TikTok はアプリ内ブラウザで読み、--merge で足す
    （X はヘッドレスだと 403、TikTok はヘッドレスだと動画の一覧が出ない）

どの投稿が予約のどの枠かは、画面（index.html の投稿タブ）が日付・時刻・本文で照らし合わせる。ここは集めるだけ。

使い方:
  python tools/posts_fetch.py                 自動の分（IG・YouTube）を取る
  python tools/posts_fetch.py --merge f.json  アプリ内ブラウザで読んだ分を足す。f.json = {"hiyoko|X": [投稿, ...], ...}
"""
import datetime
import io
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "posts_check.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
KEEP_DAYS = 45      # これより古い投稿は捨てる
PER_ACCOUNT = 12    # 1アカウントで覚えておく投稿の数（新しい順）
CHANNELS = ("hiyoko", "nacha", "reel", "yuyu")   # 予約タブにあるアカウント
KIND = {"Instagram": "IG", "YouTube": "YT", "X": "X", "Facebook": "FB", "TikTok": "TT"}


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def num(s):
    if s is None:
        return None
    s = str(s).replace(",", "").strip()
    if not s:
        return 0
    m = 1
    if s[-1:] in "KkMm":
        m = 1000 if s[-1] in "Kk" else 1000000
        s = s[:-1]
    try:
        return int(round(float(s) * m))
    except ValueError:
        return None


def load():
    try:
        return json.load(io.open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        return {"note": "投稿タブ用。tools/posts_fetch.py が書く", "updated": "", "accounts": {}}


def merge(data, key, posts, source):
    """同じリンクの投稿は数字を新しくする。古いもの・多すぎるものは捨てる"""
    acct = data["accounts"].setdefault(key, {"posts": []})
    by = {p["url"]: p for p in acct.get("posts", [])}
    for p in posts:
        if not p.get("url"):
            continue
        old = by.get(p["url"], {})
        old.update({k: v for k, v in p.items() if v is not None and v != ""})
        old["seen"] = now_iso()
        by[p["url"]] = old
    cut = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=KEEP_DAYS)).isoformat()
    keep = [p for p in by.values() if (p.get("at") or "9999") >= cut]
    keep.sort(key=lambda p: p.get("at") or "", reverse=True)
    acct["posts"] = keep[:PER_ACCOUNT * 2]
    acct["checkedAt"] = now_iso()
    acct["source"] = source


def ig_posts(page, url):
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3500)
    hrefs = page.eval_on_selector_all("a[href*='/p/'], a[href*='/reel/']", "els => [...new Set(els.map(e => e.href))]")
    out = []
    for h in hrefs[:8]:
        page.goto(h, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)
        meta = page.query_selector("meta[property='og:description']")
        desc = meta.get_attribute("content") if meta else ""
        t = page.query_selector("time[datetime]")
        at = t.get_attribute("datetime") if t else ""
        # 例: 9 likes, 1 comments - hiyoko_global on October 7, 2026: "本文"
        m = re.match(r'\s*([\d.,KkMm]+) likes?, ([\d.,KkMm]+) comments? - .*?: "(.*)"\.?\s*$', desc or "", re.S)
        # リンクは共有しやすい短い形にそろえる（instagram.com/ユーザー名/p/… → instagram.com/p/…）
        out.append({"url": re.sub(r"instagram\.com/[^/]+/(p|reel)/", r"instagram.com/\1/", h.split("?")[0]), "at": at, "text": m.group(3) if m else "",
                    "likes": num(m.group(1)) if m else None, "comments": num(m.group(2)) if m else None,
                    "views": None, "kind": "reel" if "/reel/" in h else "post"})
    return out


def yt_get(u):
    req = urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")


def yt_posts(url):
    ids = []
    for tail in ("/shorts", "/videos"):
        try:
            for v in re.findall(r'"videoId":"([\w-]{11})"', yt_get(url.rstrip("/") + tail)):
                if v not in ids:
                    ids.append(v)
        except Exception:
            pass
    out = []
    for v in ids[:6]:
        h = yt_get("https://www.youtube.com/watch?v=" + v)
        at = (re.search(r'"publishDate":"([^"]+)"', h) or re.search(r'"uploadDate":"([^"]+)"', h))
        vd = re.search(r'"videoDetails":\{.*?"title":"((?:[^"\\]|\\.)*)".*?"viewCount":"(\d+)"', h, re.S)
        desc = re.search(r'"shortDescription":"((?:[^"\\]|\\.)*)"', h)
        like = re.search(r'"accessibilityText":"([\d,.KkMm]+) likes?"', h)
        title = json.loads('"' + vd.group(1) + '"') if vd else ""
        body = json.loads('"' + desc.group(1) + '"') if desc else ""
        out.append({"url": "https://www.youtube.com/shorts/" + v, "at": at.group(1) if at else "",
                    "text": (title + ("\n" + body if body and body != title else "")).strip(),
                    "views": int(vd.group(2)) if vd else None, "likes": num(like.group(1)) if like else None,
                    "comments": None})
    return out


def auto():
    posts = json.load(io.open(ROOT / "posts.json", encoding="utf-8"))
    data = load()
    report, warn = [], []
    targets = []
    for c in posts.get("channels", []):
        if c.get("id") not in CHANNELS:
            continue
        for l in c.get("links", []):
            if l.get("kind") in ("Instagram", "YouTube"):
                targets.append((c["id"], l["kind"], l["url"]))
    for ch, kind, url in [t for t in targets if t[1] == "YouTube"]:
        try:
            got = yt_posts(url)
            merge(data, ch + "|YT", got, "auto")
            report.append("%s YouTube: %d件" % (ch, len(got)))
        except Exception as e:
            warn.append("%s YouTube: 失敗（%s）" % (ch, e))
    ig = [t for t in targets if t[1] == "Instagram"]
    if ig:
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            warn.append("Instagram: playwright が入っていない")
            ig = []
    if ig:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True)
            page = b.new_context(user_agent=UA, locale="en-US", viewport={"width": 1280, "height": 900}).new_page()
            for ch, kind, url in ig:
                try:
                    got = ig_posts(page, url)
                    merge(data, ch + "|IG", got, "auto")
                    report.append("%s Instagram: %d件" % (ch, len(got)))
                except Exception as e:
                    warn.append("%s Instagram: 失敗（%s）" % (ch, e))
            b.close()
    data["updated"] = now_iso()
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print("\n".join(report))
    if warn:
        print("注意:\n  " + "\n  ".join(warn))
    return 0


def merge_file(path, source):
    got = json.load(io.open(path, encoding="utf-8"))
    data = load()
    for key, plist in got.items():
        if not re.match(r"^[a-z0-9_-]+\|(X|IG|FB|TT|YT)$", key):
            print("とばした: " + key)
            continue
        merge(data, key, plist, source)
        print("%s: %d件" % (key, len(plist)))
    data["updated"] = now_iso()
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) >= 3 and sys.argv[1] == "--merge":
        sys.exit(merge_file(sys.argv[2], "browser"))
    sys.exit(auto())

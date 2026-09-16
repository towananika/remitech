# -*- coding: utf-8 -*-
"""KPIの自動取得。毎日12:00にこのPCの定期実行から呼ばれる。

取れるもの / 取れないもの（2026-09-16 にPlaywright（ブラウザを実際に動かす方式）で試した結果）
  YouTube    : 公開ページ（HTMLだけ）に登録者数・動画数が書いてある → 自動（urllib）
  Instagram  : ヘッドレスブラウザで開けば、ログインなしでも見える → 自動（Playwright）
  TikTok     : ヘッドレスブラウザで開くと最初に「Please wait...」の壁が出るが、数秒待つと通る → 自動（Playwright）
  X（旧Twitter）: 実際の（この会話の）ブラウザでは見えるのに、ヘッドレスブラウザだと
                 ログイン画面より前に 403 で弾かれる（データセンター/自動化と判定されている）→ まだ手入力
  Facebook   : ログインしないとフォロワー数を出さない作り → 手入力（ログインは扱わない）

  X は Instagram・TikTok と違って、ヘッドレス（画面を持たない）ブラウザだと一律403で止められる。
  突破するには、実在のブラウザに近い偽装（プロキシ・指紋対策など）が要り、それは規約への抵触が
  強くなるためやらない。今の技術で自動化できるのはここまで。

やること
  1. 各チャンネルの YouTube の公開ページを読む（urllib、軽い）
  2. 各チャンネルの Instagram・TikTok の公開ページを、ヘッドレスブラウザ（Playwright）で開いて読む
  3. 前回の記録と比べて、おかしな値（半分以下・3倍超）なら書かずに知らせる
  4. kpi.json に今日の行を足す（同じ日・同じアカウントの行があれば上書き）
  push はしない（まだ出していないコミットが混ざらないように）。

  初回だけ: pip install playwright && python -m playwright install chromium が要る
  （このPCでは2026-09-16に実施済み）。
"""
import io, json, re, sys, datetime, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None


def num(s):
    s = s.replace(",", "").strip()
    m = 1
    if s[-1:] in "KM":
        m = 1000 if s[-1] == "K" else 1000000
        s = s[:-1]
    return int(round(float(s) * m))


def youtube(url):
    about = url.rstrip("/") + "/about"
    req = urllib.request.Request(about, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    # 画面の見出し部分（"xx subscribers" と "yy videos" が並ぶ所）を先に探す
    m = re.search(r'"content":"([\d.,]+[KM]?) subscribers".{0,400}?"content":"([\d.,]+[KM]?) videos"', html)
    if not m:
        subs = re.search(r'([\d.,]+[KM]?) subscribers', html)
        vids = re.search(r'([\d.,]+[KM]?) videos', html)
        if not subs:
            raise ValueError("登録者数が見つからない")
        return num(subs.group(1)), (num(vids.group(1)) if vids else None)
    return num(m.group(1)), num(m.group(2))


def num_from_text(text):
    # 言語に依存しない形で「245」+直後に「Followers/followers/팔로워/フォロワー」が続く所を拾う
    m = re.search(r'([\d,\.]+[KM]?)\s*\n?\s*(Followers|followers|팔로워|フォロワー)', text)
    return num(m.group(1)) if m else None


def ig_followers(page, url):
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(2500)
    v = num_from_text(page.inner_text("body"))
    if v is None:
        raise ValueError("フォロワー数が見つからない")
    return v


def tiktok_followers(page, url):
    page.goto(url, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(4000)  # 「Please wait...」のWAFチャレンジが通るまで待つ
    v = num_from_text(page.inner_text("body"))
    if v is None:
        raise ValueError("フォロワー数が見つからない")
    return v


PW_FETCH = {"Instagram": ig_followers, "TikTok": tiktok_followers}
PW_PLATFORM = {"Instagram": "IG", "TikTok": "TT"}


def try_write(rows, today, ch_id, platform, value, warn, report, label):
    prev = [r for r in rows if r["channel"] == ch_id and r["platform"] == platform and r["date"] < today]
    prev = sorted(prev, key=lambda r: r["date"])[-1] if prev else None
    if prev and prev.get("followers") and (value < prev["followers"] * 0.5 or value > prev["followers"] * 3 + 10):
        warn.append("%s: 前回 %s → 今回 %s。差が大きすぎるので書かなかった" % (label, prev["followers"], value))
        return
    rows[:] = [r for r in rows if not (r["date"] == today and r["channel"] == ch_id and r["platform"] == platform)]
    rows.append({"date": today, "channel": ch_id, "platform": platform, "followers": value, "source": "auto"})
    diff = "" if not prev else " (%+d)" % (value - prev["followers"])
    report.append("%s: フォロワー %s%s" % (label, value, diff))


def main():
    today = datetime.date.today().isoformat()
    posts = json.load(io.open(ROOT / "posts.json", encoding="utf-8"))
    kpi_path = ROOT / "kpi.json"
    kpi = json.load(io.open(kpi_path, encoding="utf-8"))
    rows = kpi.setdefault("rows", [])
    report, warn = [], []

    # ---- YouTube（軽い、urllib）----
    for ch in posts.get("channels", []):
        for link in ch.get("links", []):
            if link.get("kind") != "YouTube":
                continue
            try:
                subs, vids = youtube(link["url"])
            except Exception as e:
                warn.append("%s YT: 取れなかった（%s）" % (ch["id"], e))
                continue
            prev = [r for r in rows if r["channel"] == ch["id"] and r["platform"] == "YT" and r["date"] < today]
            prev = sorted(prev, key=lambda r: r["date"])[-1] if prev else None
            if prev and prev.get("followers") and (subs < prev["followers"] * 0.5 or subs > prev["followers"] * 3 + 10):
                warn.append("%s YT: 前回 %s → 今回 %s。差が大きすぎるので書かなかった" % (ch["id"], prev["followers"], subs))
                continue
            rows[:] = [r for r in rows if not (r["date"] == today and r["channel"] == ch["id"] and r["platform"] == "YT")]
            row = {"date": today, "channel": ch["id"], "platform": "YT", "followers": subs}
            if vids is not None:
                row["videos"] = vids
            row["source"] = "auto"
            rows.append(row)
            diff = "" if not prev else " (%+d)" % (subs - prev["followers"])
            report.append("%s YT: 登録者 %s%s・動画 %s" % (ch["id"], subs, diff, vids))

    # ---- Instagram・TikTok（ヘッドレスブラウザ、重いので一度だけ起動）----
    if sync_playwright is None:
        warn.append("Instagram・TikTok: playwright が入っていない（pip install playwright && python -m playwright install chromium）")
    else:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                ctx = browser.new_context(user_agent=UA, locale="en-US", viewport={"width": 1280, "height": 900})
                page = ctx.new_page()
                for ch in posts.get("channels", []):
                    for link in ch.get("links", []):
                        fn = PW_FETCH.get(link.get("kind"))
                        if not fn:
                            continue
                        platform = PW_PLATFORM[link["kind"]]
                        label = "%s %s" % (ch["id"], link["kind"])
                        try:
                            v = fn(page, link["url"])
                        except Exception as e:
                            warn.append("%s: 取れなかった（%s）" % (label, e))
                            continue
                        try_write(rows, today, ch["id"], platform, v, warn, report, label)
                browser.close()
        except Exception as e:
            warn.append("Instagram・TikTok: ヘッドレスブラウザの起動に失敗（%s）" % e)

    rows.sort(key=lambda r: (r["date"], r["channel"], r["platform"]))
    io.open(kpi_path, "w", encoding="utf-8", newline="").write(json.dumps(kpi, ensure_ascii=False, indent=2) + "\n")
    manual = "手入力が要るもの（自動化できない）: X（HIYOKO・NACHA・悠悠観音堂・REEL、ヘッドレスブラウザが403で弾かれる）、Facebook（HIYOKO、ログインが要る）"
    print("\n".join(["[%s] KPI 自動取得" % today] + report + warn + [manual]))
    return 1 if warn else 0


if __name__ == "__main__":
    sys.exit(main())

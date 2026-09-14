# -*- coding: utf-8 -*-
"""KPIの自動取得（YouTubeだけ）。毎日12:00にこのPCの定期実行から呼ばれる。

取れるもの / 取れないもの（2026-09-14 に試した結果）
  YouTube   : 公開ページから登録者数・動画数が読める → 自動
  TikTok    : 中身のない画面が返る → 手入力
  Facebook  : 400 で断られる → 手入力
  X・Instagram : 規約上、自動アクセスを避ける → 手入力

やること
  1. 各チャンネルの YouTube の公開ページを読む
  2. 前回の記録と比べて、おかしな値（半分以下・3倍超）なら書かずに知らせる
  3. kpi.json に今日の行を足す（同じ日・同じアカウントの行があれば上書き）
  push はしない（まだ出していないコミットが混ざらないように）。
"""
import io, json, re, sys, datetime, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


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


def main():
    today = datetime.date.today().isoformat()
    posts = json.load(io.open(ROOT / "posts.json", encoding="utf-8"))
    kpi_path = ROOT / "kpi.json"
    kpi = json.load(io.open(kpi_path, encoding="utf-8"))
    rows = kpi.setdefault("rows", [])
    report, warn = [], []

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

    rows.sort(key=lambda r: (r["date"], r["channel"], r["platform"]))
    io.open(kpi_path, "w", encoding="utf-8", newline="").write(json.dumps(kpi, ensure_ascii=False, indent=2) + "\n")
    manual = "手入力が要るもの: X（HIYOKO・NACHA・悠悠観音堂・REEL）、Instagram（HIYOKO・NACHA・REEL）、TikTok（HIYOKO・NACHA）、Facebook（HIYOKO）"
    print("\n".join(["[%s] KPI 自動取得" % today] + report + warn + [manual]))
    return 1 if warn else 0


if __name__ == "__main__":
    sys.exit(main())

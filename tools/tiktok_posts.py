"""TikTokの公開埋め込み一覧と個別動画の公開データを読む。ログイン不要。"""
import datetime
import json
import re
import sys
from html.parser import HTMLParser
from urllib.parse import urlsplit


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__()
        self.current = None
        self.values = {}

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self.current = dict(attrs).get("id")

    def handle_data(self, data):
        if self.current:
            self.values[self.current] = self.values.get(self.current, "") + data

    def handle_endtag(self, tag):
        if tag == "script":
            self.current = None


def state(html, script):
    parser = Scripts()
    parser.feed(html)
    return json.loads(parser.values[script])


def creator_videos(html, handle):
    data = state(html, "__FRONTITY_CONNECT_STATE__")["source"]["data"]["/embed/@" + handle]
    if data.get("isError"):
        raise ValueError("TikTokの公開一覧を取得できません")
    videos, seen = [], set()
    for item in data.get("videoList", []):
        vid = str(item.get("id", ""))
        if (re.fullmatch(r"\d{10,25}", vid) and vid not in seen
                and item.get("authorUniqueId", "").lower() == handle.lower()
                and item.get("privateItem") is not True):
            videos.append(item)
            seen.add(vid)
    if not videos:
        raise ValueError("TikTokの公開動画が見つかりません")
    return videos


def video_post(html, handle, vid):
    detail = state(html, "__UNIVERSAL_DATA_FOR_REHYDRATION__")["__DEFAULT_SCOPE__"]["webapp.video-detail"]
    if detail.get("statusCode", 0) != 0:
        raise ValueError("TikTokの動画を確認できません")
    item = detail["itemInfo"]["itemStruct"]
    if (str(item.get("id")) != vid or item.get("author", {}).get("uniqueId", "").lower() != handle.lower()
            or any(item.get(flag) for flag in ("privateItem", "secret", "forFriend", "takeDown", "isProhibited"))):
        raise ValueError("TikTokの投稿者・公開状態が一致しません")
    # 予約投稿ではID内の時刻が前日になる。動画ページのcreateTimeだけを使う。
    at = datetime.datetime.fromtimestamp(int(item["createTime"]), datetime.timezone.utc)
    if at.year < 2016 or at > datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5):
        raise ValueError("TikTokの公開日時を確認できません")
    stats = item.get("stats") or {}
    def count(key):
        value = stats.get(key)
        try:
            return int(value) if value is not None and int(value) >= 0 else None
        except (ValueError, TypeError):
            return None
    return {"url": "https://www.tiktok.com/@" + handle + "/video/" + vid,
            "at": at.isoformat(), "text": item.get("desc", ""),
            "likes": count("diggCount"), "comments": count("commentCount"),
            "views": count("playCount"), "reposts": count("shareCount"),
            "pinned": bool(item.get("isPinnedItem") or item.get("isTop")),
            "linkCheck": {"state": "ok", "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}}


def tiktok_posts(page, url):
    parsed = urlsplit(url)
    match = re.fullmatch(r"/@([A-Za-z0-9_.]+)/*", parsed.path)
    if parsed.scheme != "https" or parsed.hostname not in ("tiktok.com", "www.tiktok.com") or not match:
        raise ValueError("TikTokのプロフィールURLが不正です")
    handle = match.group(1)
    page.goto("https://www.tiktok.com/embed/@" + handle, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_selector("script#__FRONTITY_CONNECT_STATE__", state="attached", timeout=10000)
    candidates = creator_videos(page.content(), handle)
    out = []
    for candidate in candidates[:12]:
        vid = str(candidate["id"])
        try:
            page.goto("https://www.tiktok.com/@" + handle + "/video/" + vid,
                      wait_until="domcontentloaded", timeout=30000)
            page.wait_for_selector("script#__UNIVERSAL_DATA_FOR_REHYDRATION__", state="attached", timeout=10000)
            out.append(video_post(page.content(), handle, vid))
        except Exception:
            print("TikTok: 公開日時・投稿者を確認できない動画を保留: " + vid, file=sys.stderr)
    if not out:
        raise ValueError("TikTokの公開日時を確認できる動画がありません。前回の記録を保持します")
    return out

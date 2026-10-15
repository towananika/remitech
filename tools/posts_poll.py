"""HUB の「投稿確認」ボタンの依頼を見る（2026-10-15 Hibiki指定）。
Windows のタスクスケジューラから2分ごとに動く。サーバー（/fetchreq）に依頼が置かれていれば、
posts_daily.run() で各 SNS を読んで push し、進行中・済みをサーバーに知らせる。依頼がなければ何もしない（すぐ終わる）。
"""
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import posts_daily  # noqa: E402

API = "https://remitech-chores.jaykim-can.workers.dev/fetchreq"


def call(path, body=None):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode("utf-8") if body is not None else None,
                                 headers={"Content-Type": "application/json", "User-Agent": "remitech-posts-poll"},
                                 method="POST" if body is not None else "GET")
    return json.loads(urllib.request.urlopen(req, timeout=20).read().decode("utf-8"))


def main():
    try:
        cur = call("")
    except Exception as e:
        posts_daily.log(["poll: サーバーに届かない（%s）" % e])
        return 1
    if cur.get("state") != "pending":
        return 0
    call("/state", {"state": "running", "msg": ""})
    try:
        ok, summary = posts_daily.run("button")
    except Exception as e:
        call("/state", {"state": "error", "msg": "読み取りに失敗: %s" % str(e)[:200]})
        return 1
    call("/state", {"state": "done" if ok else "error", "msg": summary if ok else "push に失敗: " + summary})
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

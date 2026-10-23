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
import kpi_manual  # noqa: E402

API = "https://remitech-chores.jaykim-can.workers.dev/fetchreq"


def call(path, body=None, scope=None):
    url = API + path + ("?scope=kpi" if scope == "kpi" else "")
    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8") if body is not None else None,
                                 headers={"Content-Type": "application/json", "User-Agent": "remitech-posts-poll"},
                                 method="POST" if body is not None else "GET")
    return json.loads(urllib.request.urlopen(req, timeout=20).read().decode("utf-8"))


def poll(scope=None):
    try:
        cur = call("", scope=scope)
    except Exception as e:
        posts_daily.log(["poll: サーバーに届かない（%s）" % e])
        return 1
    if cur.get("state") != "pending":
        return 0
    call("/state", {"state": "running", "msg": ""}, scope=scope)
    try:
        if scope == "kpi":
            ok, summary = kpi_manual.run()
        else:
            ok, summary = posts_daily.run("button", telegram_date=cur.get("date") if cur.get("scope") == "telegram" else None)
    except Exception as e:
        call("/state", {"state": "error", "msg": "更新に失敗しました。実行PCの接続・公開設定を確認してください。"}, scope=scope)
        return 1
    call("/state", {"state": "done" if ok else "error", "msg": summary}, scope=scope)
    return 0 if ok else 1


def main():
    # 監視だけではKPIを取得しない。KPIと投稿確認は別の依頼として扱う。
    results = []
    for scope in (None, "kpi"):
        try:
            results.append(poll(scope))
        except Exception:
            results.append(1)
    return max(results)


if __name__ == "__main__":
    sys.exit(main())

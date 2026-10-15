"""投稿の一覧を読んで push する（2026-10-10 Hibiki了承「1そう」、2026-10-15 X も自動に）。
Windows のタスクスケジューラから:
  ・毎日 17:20（HIYOKO・REEL の17時の投稿のあと）と 20:20（NACHA の20時の投稿のあと）
  ・HUB の「投稿確認」ボタンの依頼を見たとき（tools/posts_poll.py から run() を呼ぶ）
Instagram・YouTube・X の最近の投稿を posts_check.json に集め → それだけをコミット → push してサイトに出す。
（Facebook・TikTok はログインしないと読めない）
ログ: tools/posts_daily.log（最後の 200 行だけ残す）
"""
import datetime
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = os.path.join(ROOT, "tools", "posts_daily.log")
TRAILER = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")


def log(lines):
    old = []
    try:
        old = open(LOG, encoding="utf-8").read().splitlines()
    except OSError:
        pass
    open(LOG, "w", encoding="utf-8").write("\n".join((old + lines)[-200:]) + "\n")


def run(why="daily"):
    """読んで push する。返す: (うまくいったか, 一言のまとめ)"""
    lines = ["==== %s (%s)" % (datetime.datetime.now().isoformat(timespec="seconds"), why)]
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    # Claude のアプリの中から入れた Playwright のブラウザは、アプリ専用の AppData に入っていて、
    # タスクスケジューラからは見えない（2026-10-10 判明）。アプリの外から見える ~/.ms-playwright に写したものを使う
    pw = os.path.join(os.path.expanduser("~"), ".ms-playwright")
    if os.path.isdir(pw):
        env["PLAYWRIGHT_BROWSERS_PATH"] = pw
    pf = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "posts_fetch.py")],
                        cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8")
    out = pf.stdout.strip()
    lines.append(out)
    if pf.stderr.strip():
        err = [x for x in pf.stderr.strip().splitlines() if "Error" in x or "error" in x or "Executable" in x or "exist" in x]
        lines.append("stderr: " + " / ".join(err)[:900])
    if git("status", "--porcelain", "--", "posts_check.json").stdout.strip():
        # ほかの変更が混ざらないよう、このファイルだけをコミットする
        git("add", "posts_check.json")
        msg = "投稿の一覧: 自動で読む (%s, %s)\n\n%s" % (datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), why, TRAILER)
        c = git("commit", "-m", msg, "--", "posts_check.json")
        lines.append("commit: " + ("ok" if c.returncode == 0 else c.stderr.strip()))
    else:
        lines.append("commit: 変更なし")
    p = git("push")
    if p.returncode != 0:
        # サーバーの方が新しいときは、こちらのコミットを上に載せ直してからもう一度
        r = git("pull", "--rebase", "--autostash")
        lines.append("pull: " + ("ok" if r.returncode == 0 else r.stderr.strip()[-300:]))
        p = git("push")
    lines.append("push: " + ("ok" if p.returncode == 0 else p.stderr.strip()[-300:]))
    log(lines)
    got = [l for l in out.splitlines() if "件" in l]
    fails = out.count("失敗")
    summary = "%d アカウント読んだ%s" % (len(got), "（%d 件失敗）" % fails if fails else "")
    return p.returncode == 0, summary


if __name__ == "__main__":
    ok, _ = run("daily")
    sys.exit(0 if ok else 1)

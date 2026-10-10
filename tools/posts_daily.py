"""投稿のあとの自動取得（2026-10-10 Hibiki了承「1そう」）。
Windows のタスクスケジューラから毎日 17:20（HIYOKO・REEL の17時の投稿のあと）と 20:20（NACHA の20時の投稿のあと）に動く。
Instagram・YouTube の最近の投稿を posts_check.json に集め → それだけをコミット → push してサイトに出す。
（X・Facebook・TikTok は自動では読めない。X は Claude に「投稿確認して」）
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


def main():
    lines = ["==== %s" % datetime.datetime.now().isoformat(timespec="seconds")]
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    pf = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "posts_fetch.py")],
                        cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8")
    lines.append(pf.stdout.strip())
    if pf.stderr.strip():
        lines.append(pf.stderr.strip()[-600:])
    if git("status", "--porcelain", "--", "posts_check.json").stdout.strip():
        # ほかの変更が混ざらないよう、このファイルだけをコミットする
        git("add", "posts_check.json")
        msg = "投稿の一覧: Instagram・YouTube を自動で読む (%s)\n\n%s" % (datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), TRAILER)
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
    old = []
    try:
        old = open(LOG, encoding="utf-8").read().splitlines()
    except OSError:
        pass
    open(LOG, "w", encoding="utf-8").write("\n".join((old + lines)[-200:]) + "\n")
    return 0 if p.returncode == 0 else 1


if __name__ == "__main__":
    sys.exit(main())

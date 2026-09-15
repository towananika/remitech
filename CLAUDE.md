# REMITECH HUB 開発ルール

日本語で簡潔に。結論→根拠→補足。

## 構成（覚えておけば全文を読まなくていい）
- `index.html`（約5500行）1枚に全部。IIFE、文言は `T={en,ko,ja}` と `t()`、状態は `tab` / `filter` / `schedule` / `chores` / `kpi`
- データ: `posts.json`（チャンネル・docs・telegramAt）、`book_rows.json`（予約の行）、`chores.json`（いいね・フォロー）、`kpi.json`、`schedule.json`
- サーバー: `worker/chores-worker.js`（Cloudflare Worker + Durable Object `HubDO`。/chores /book /code /ws）
- 公開: GitHub Pages https://towananika.github.io/remitech/ （service worker なし）

## トークン節約
- **index.html を全文読まない。** 先に Grep で行を引き、`Read(offset, limit)` で 30〜150 行だけ読む
  - タブの画面: `function render(Today|Likes|Book|Prep|Prep2|Kpi|Telegram|Guide|Overview)`
  - タブの切り替え: `function renderNav` / `if (tab === "`
  - 文言: `navTg:` のような key で3言語の行を一度に引く（`-o` で値だけ）
  - CSS: `^\s*\.クラス名`
- 編集は Edit ツールで、一意な短い文字列を狙う。`\u` エスケープや正規表現をシェルのヒアドキュメントに書かない
- 互いに関係ない読み取り・編集・確認は、1回の応答にまとめて並べる
- 大きな変更の前にだけ計画を書く。小さな変更は即実行して報告

## 確かめ方（毎回この順）
1. 構文: `<script>` を抜き出して `node --check`（スクラッチパッドに書き出す）
2. 画面: `python -m http.server 8899 --bind 127.0.0.1` → Browser ペインで開き、`javascript_tool` で表示テキストを読む（スクショは要る時だけ）
3. スマホ幅: `resize_window` mobile で横はみ出しを確認し、desktop に戻す
4. 本物のデータ（kpi.json・サーバー）に書き込む操作は試さない。試していないと報告に書く

## 公開
- コミットはこまめにローカルへ。**push は Hibiki が「プッシュして」と言ったときだけ**（直しでも一言聞く）
- push は `git pull --rebase` → `git push`。その後、公開ファイルに変更の目印が入るまで curl で待つ
- 報告は「公開ファイルに入った」と「端末の画面は未確認」を分けて書く

## セキュリティ
- パスワード・トークンを扱わない。編集パスワードは Hibiki が `worker/set-team-code.ps1` で設定する

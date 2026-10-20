# REEL 投稿タブ

`/editor` は既存ログインの社員・管理者だけが読み書きできる。一般会員・未ログインは拒否する。投稿データは Durable Object の `reel:week:*` に置き、公開 JSON や公開 `/book` には本文を入れない。

- 日付を開くと未作成の草案を自動生成。既存週を上書きせず、4週間のテーマ重複を避ける。週ごとに流れを持たせ、再利用時は切り口と本文を変える。
- X と IG は別の短文（英語 X 240文字以内、IG 500文字以内）。2026年10月の提供原稿は参考のみで、原稿データは保存しない。
- HIBIKI の承認操作はない。作者は日英本文を編集し、NOBO は「問題なし」または英文の修正版を保存する。修正版があればコピー対象にし、元の英文も残す。
- NOBO確認後、または投稿日前日00:00（Asia/Seoul）から英語をコピーできる。未確認なら元の英文を使う。本文変更・再生成でNOBO確認と画像プロンプトをリセットする。
- 画像プロンプトはボタンで生成・コピーし、画面には表示しない。
- 予約は各SNSで実際に予約した後の手動記録。既存の `reel|日付|SNS|17:00` を共有し、予約タブの変更も読み直す。予約済みの文章は先に予約解除してから変更する。

## ローカル

既存チェックアウトを使う。ワークツリーを新設しない。

```sh
# /workspace/remitech
python3 -m http.server 8899 --bind 127.0.0.1
# 別のターミナル /workspace/remitech/worker
XDG_CONFIG_HOME=/workspace/.remitech-dev/config WRANGLER_SEND_METRICS=false \
  /workspace/.remitech-dev/node_modules/.bin/wrangler dev \
  --config wrangler.local.toml --local --ip 127.0.0.1 --port 8787 \
  --persist-to /workspace/.remitech-dev/state
```

ブラウザ起動前に localStorage の `remitech-chore-api` を `http://127.0.0.1:8787/chores` に設定する。ローカル設定にはAIを接続しない。AI応答・エラー・競合はテストの代替バインディングで検証できる。

```sh
# /workspace/remitech
node --test tests/reel-workflow.test.mjs
```

`posts-preview.html` は公開できるデザイン確認用ページ。新しく用意したサンプルだけを表示し、実データ・会員情報は含めず、更新処理にも接続しない。本物の投稿タブの権限制限を変えない。

## 本番の初回反映

GitHub Pagesの公開とWorkerの公開は別。`wrangler.toml` の `[ai]` がWorkers AIに接続する。対象Cloudflareアカウントへの公開権限とWorkers AIの利用設定が必要。APIトークンをソース、コマンド引数、公開ファイルに書かない。

```sh
# /workspace/remitech/worker — 認証済みの環境でのみ
wrangler deploy
```

NOBOは既存のログイン画面から本人が通常の会員登録を行う。管理者は既存の会員管理画面で社員権限を付ける。追加の初期アカウントやパスワードは配布しない。Cloudflare経由の会員追加は行わない。

NOBO修正は専用ダイアログで入力する。入力のたびに、この端末のlocalStorageへアカウント・日付・SNS別の下書きを保存する。閉じる・再読み込み後も「保存した下書きから再開」で復元する。共有保存の成功が確認できたときだけダイアログを閉じ、下書きを削除する。通信失敗・古い版との競合では入力を残す。「この端末の下書き」と「共有保存済み」を区別する。共有保存には更新版Workerの反映が必要で、ブラウザの下書き保存だけでは他の端末へ同期しない。

NOBOの既存IDが別の場合は `REEL_SECONDARY_IDS` を実際のIDに合わせる。管理者・他の社員がNOBOとして監修を記録することはできない。

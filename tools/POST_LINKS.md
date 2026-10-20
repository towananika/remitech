# 投稿リンクの確認

`post_links.post_url` はSNSごとの投稿ID・ドメインを確認します。Facebookの `story_fbid` / `id` / `fbid` / `v`、YouTubeの `v` は投稿を特定するために必要なので削除しません。プロフィール、ログイン画面、IDが欠けたURLは投稿リンクとして保存しません。既存の不正URLも次回のmergeで除外します。

Facebookは一覧から見つけたリンクだけではアクセス済みと扱いません。`fb_check_link` が個別投稿を開き、HTTPエラー・ログイン／別ページへの転送・利用不可の文言を調べ、同一投稿のcanonical URLと本文を確認します。不明な場合は `unverified`、利用不可は `unavailable`。画面の緑の確認表示には、URLと一致する24時間以内の `linkCheck.state=ok` が必要です。過去のアクセス成功は将来の公開状態を保証しません。

画面は韓国時間の投稿日と投稿URL形式も確認します。FBについては「リンク無効」「アクセス未確認」「アクセス不可」を区別し、確認できないURLを共有文に入れません。固定のStoriesリンクは投稿日確認済みとして扱いません。

確認コマンド（実データの更新・SNSアクセスなし）:

```
python -m unittest discover -s tests -p 'test_post_links.py'
node tests/telegram-post-date.test.mjs
```

PC側の定期取得にもこの修正を使うには、リポジトリの最新コードを取得してください。壊れたURLから失われた投稿IDは復元・推測しません。

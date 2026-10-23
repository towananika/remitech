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

## TikTok

`tiktok_posts.py` は公式の公開クリエイター埋め込み（`/embed/@ユーザー名`）から動画一覧を読み、各動画ページの公開データで投稿ID・投稿者・公開状態・公開日時を照合します。通常のプロフィールで動画一覧がエラーになっても、公開埋め込みが読める場合は取得できます。ログインや認証回避は行いません。

動画ID内の時刻はアップロード時刻であり、予約投稿の公開日とは限りません。共有文の投稿日には個別動画の `createTime` だけを使い、Instagram・YouTubeの投稿日から推測しません。日時・投稿者・公開状態を確認できない動画は保留し、全件失敗なら既存の記録と確認日時を保持します。

TikTokは通常の定期取得と、HUBの「投稿確認」「更新」から行う投稿取得の対象です。KPIの更新とは別処理です。取得処理を動かすPCへの最新コードの取り込みも必要です。

```
python -m unittest discover -s tests -p 'test_tiktok_posts.py'
```

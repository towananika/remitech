# 画像・動画の置き場（Cloudflare R2）

HUB は GitHub Pages に置いてあり、ファイルを書けない。
ここが受け口になる。読むのは誰でも、書くのは合言葉を知っている人だけ。

## 用意する（初回だけ）

1. <https://dash.cloudflare.com> → **R2** を開く
   - 初めてなら「R2 を有効にする」を押す（カードの登録を求められる。10GBまで無料）
2. **Create bucket** → 名前は `remitech-media`
3. ここで次を1行ずつ実行する

```
cd "C:\Users\Hibiki\OneDrive\ドキュメント\remitech\worker"
```
```
npx wrangler deploy
```
```
npx wrangler secret put UPLOAD_TOKEN
```

`UPLOAD_TOKEN` は貼り付けを求められる。長い文字列を入れる（作り方は下）。

## 合言葉を作る

PowerShell で1行ずつ:

```
$b = New-Object byte[] 24
```
```
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
```
```
[Convert]::ToBase64String($b).Replace('+','-').Replace('/','_').Replace('=','')
```

出てきた文字列を `wrangler secret put` に貼り、控えを
`C:\Users\Hibiki\OneDrive\ドキュメント\maai-admin-token.txt` の隣に置いておく。

## HUB 側の設定

デプロイすると `https://remitech-media.<...>.workers.dev` が出る。
HUB の「取り込み」タブの下にある置き場の欄に、その住所と合言葉を入れる。
**合言葉はその端末にだけ残る。**サイトのコードには入らない。

## 注意

- 合言葉を知っている人は誰でも上げられる。人に渡すときは端末ごとに入れてもらう
- 読むほうに鍵はかけていない。投稿に使う画像なので、いずれ公開されるため
- 1本100MBまで

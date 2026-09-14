# REMITECH HUB — 編集用パスワードを Cloudflare に設定する（Hibiki だけが使う）
#
# 使い方: このフォルダで PowerShell を開き、次を1行ずつ実行
#   cd "C:\Users\Hibiki\OneDrive\ドキュメント\remitech\worker"
#   powershell -ExecutionPolicy Bypass -File ".\set-team-code.ps1"
#
# 「Enter a secret value」と聞かれたら、パスワード（8文字以上）を入力して Enter。入力は画面に出ません。
# パスワードは wrangler に直接入力する（パイプで渡すと wrangler が別のログインを求めて失敗するため）。
#
# 設定すると: 見るのは誰でもできる。いいね・フォロー・予約タブの変更には、このパスワードが要る。
# 変えたいとき: もう一度このファイルを実行すれば上書きされる。外したいとき: clear-team-code.ps1

$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot

Write-Host "次に「Enter a secret value」と出たら、編集用パスワード（8文字以上）を入力して Enter を押してください。" -ForegroundColor Cyan
& npx --yes wrangler secret put TEAM_CODE
if ($LASTEXITCODE -ne 0) {
  Write-Host "失敗しました。上のエラーの文面を Claude に伝えてください（パスワードは伝えないでください）。" -ForegroundColor Red
  exit 1
}
Write-Host "設定しました。" -ForegroundColor Green

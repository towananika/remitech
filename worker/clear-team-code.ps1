# REMITECH HUB — 編集用パスワードを外す（誰でも変更できる状態に戻す）
#
# 使い方: このフォルダで PowerShell を開き、次を1行ずつ実行
#   cd "C:\Users\Hibiki\OneDrive\ドキュメント\remitech\worker"
#   powershell -ExecutionPolicy Bypass -File ".\clear-team-code.ps1"
#
# スクリプトで入れたパスワード（TEAM_CODE）と、画面で変えたパスワード（KV の cfg:codehash）の両方を消す。

$ErrorActionPreference = "Continue"
Set-Location -Path $PSScriptRoot

$ans = Read-Host "編集用パスワードを外すと、誰でも変更できるようになります。外しますか？ (y/n)"
if ($ans -ne "y") { Write-Host "やめました。"; exit 0 }

& npx --yes wrangler kv key delete "cfg:codehash" --binding CHORES --remote
& npx --yes wrangler secret delete TEAM_CODE
Write-Host "外しました（すでに無かったものは、上にエラーが出ても問題ありません）。" -ForegroundColor Green

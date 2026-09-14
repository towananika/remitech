# REMITECH HUB — 編集用パスワードを外す（誰でも変更できる状態に戻す）
#
# 使い方: このフォルダで PowerShell を開き、次を実行
#   powershell -ExecutionPolicy Bypass -File "clear-team-code.ps1"

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$ans = Read-Host "編集用パスワードを外すと、誰でも変更できるようになります。外しますか？ (y/n)"
if ($ans -ne "y") { Write-Host "やめました。"; exit 0 }

"y" | npx --yes wrangler secret delete TEAM_CODE | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "失敗しました。上のエラーを Claude に伝えてください。" -ForegroundColor Red; exit 1 }
Write-Host "外しました。" -ForegroundColor Green

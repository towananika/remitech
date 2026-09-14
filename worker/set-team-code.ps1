# REMITECH HUB — いいね作業を保存するための「チームの合言葉」を Cloudflare に入れる
#
# 使い方: このフォルダで PowerShell を開き、次を実行
#   powershell -ExecutionPolicy Bypass -File "set-team-code.ps1"
#
# 合言葉は入力しても画面に出ません。ファイルにも残しません。
# チームのみなさんには、口頭やメッセージで直接伝えてください。
# 各端末では、HUB の「いいね」タブで一度だけ入力すれば、その端末に覚えさせます。

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$secure = Read-Host "チームの合言葉（8文字以上）" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if ($plain.Length -lt 8) { Write-Host "8文字以上にしてください。" -ForegroundColor Red; exit 1 }

$plain | npx --yes wrangler secret put TEAM_CODE | Out-Null
$plain = $null
if ($LASTEXITCODE -ne 0) { Write-Host "失敗しました。上のエラーを Claude に伝えてください（合言葉は伝えないでください）。" -ForegroundColor Red; exit 1 }
Write-Host "設定しました。" -ForegroundColor Green

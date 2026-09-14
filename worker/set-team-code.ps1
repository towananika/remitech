# REMITECH HUB — 編集用パスワードを Cloudflare に設定する（Hibiki だけが使う）
#
# 使い方: このフォルダで PowerShell を開き、次を実行
#   powershell -ExecutionPolicy Bypass -File "set-team-code.ps1"
#
# 設定すると: 見るのは誰でもできる。いいね・フォロー・予約タブの変更には、このパスワードが要る。
# 設定しないと: 誰でも変更できる（パスワードなし）。
# 変えたいとき: もう一度このファイルを実行すれば上書きされる。
# 外したいとき: clear-team-code.ps1 を実行する。
#
# パスワードは入力しても画面に出ません。ファイルにも残しません。
# チームのみなさんには、口頭やメッセージで直接伝えてください。
# 各端末では、HUB で編集しようとしたときに出る入力欄に一度だけ入れれば、その端末が覚えます。

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$secure = Read-Host "編集用パスワード（8文字以上）" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if ($plain.Length -lt 8) { Write-Host "8文字以上にしてください。" -ForegroundColor Red; exit 1 }

$plain | npx --yes wrangler secret put TEAM_CODE | Out-Null
$plain = $null
if ($LASTEXITCODE -ne 0) { Write-Host "失敗しました。上のエラーを Claude に伝えてください（パスワードは伝えないでください）。" -ForegroundColor Red; exit 1 }
Write-Host "設定しました。" -ForegroundColor Green

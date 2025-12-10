# 设置 Cloudflare Workers Secrets 脚本（PowerShell）
# 
# 使用方法：
# .\scripts\set-secrets.ps1
#
# 或者直接使用 wrangler secret put 命令

Write-Host "设置 Cloudflare Workers Secrets" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# 设置 RUNPOD_API_KEY
$RUNPOD_API_KEY = Read-Host "请输入 RUNPOD_API_KEY" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($RUNPOD_API_KEY)
$PlainText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
echo $PlainText | wrangler secret put RUNPOD_API_KEY

# 设置 RUNPOD_ENDPOINT_ID
$RUNPOD_ENDPOINT_ID = Read-Host "请输入 RUNPOD_ENDPOINT_ID" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($RUNPOD_ENDPOINT_ID)
$PlainText = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
echo $PlainText | wrangler secret put RUNPOD_ENDPOINT_ID

Write-Host "================================" -ForegroundColor Green
Write-Host "Secrets 设置完成！" -ForegroundColor Green


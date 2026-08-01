$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Borza Production Deployment Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Ask for Database Password securely
$Password = Read-Host "Please enter your Supabase Database Password (input is hidden)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

# URL Encode the password to handle special characters
Add-Type -AssemblyName System.Web
$EncodedPassword = [System.Web.HttpUtility]::UrlEncode($PlainPassword)

$DatabaseUrl = "postgresql://postgres.opluurqiaoszhqwdzthk:$EncodedPassword@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# 2. Run Database Migrations
Write-Host "`n[1/4] Running Database Migrations against Supabase..." -ForegroundColor Green
$env:DATABASE_URL = $DatabaseUrl
Push-Location .\backend
try {
    # Install alembic if missing in global or local context just in case
    python -m pip install -r requirements.txt | Out-Null
    python -m alembic upgrade head
} finally {
    Pop-Location
}
Write-Host "Migrations completed successfully!" -ForegroundColor Green

# 3. Setup Vercel Project
Write-Host "`n[2/4] Linking Vercel Project..." -ForegroundColor Green
Write-Host "Please follow the prompts to link or create the Vercel project." -ForegroundColor Yellow
npx vercel link

# 4. Configure Vercel Environment Variables
Write-Host "`n[3/4] Configuring Vercel Environment Variables..." -ForegroundColor Green

# Generate a random secret for cron
$CronSecret = -join ((33..126) | Get-Random -Count 32 | % {[char]$_})

Write-Host "Setting DATABASE_URL in Vercel..." -ForegroundColor Cyan
$DatabaseUrl | npx vercel env add DATABASE_URL production
$DatabaseUrl | npx vercel env add DATABASE_URL preview

Write-Host "Setting CRON_SECRET in Vercel..." -ForegroundColor Cyan
$CronSecret | npx vercel env add CRON_SECRET production
$CronSecret | npx vercel env add CRON_SECRET preview

Write-Host "Setting REALTIME_ENABLED=false in Vercel..." -ForegroundColor Cyan
"false" | npx vercel env add REALTIME_ENABLED production
"false" | npx vercel env add REALTIME_ENABLED preview

# 5. Deploy to Vercel
Write-Host "`n[4/4] Deploying to Vercel Production..." -ForegroundColor Green
npx vercel deploy --prod

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete! " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

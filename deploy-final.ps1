$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Borza Final Deployment Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

Write-Host "`nIf you created a new Supabase project, go to Database -> Connection String -> URI." -ForegroundColor Yellow
Write-Host "Make sure to replace [YOUR-PASSWORD] with your actual password in the string before pasting it here!" -ForegroundColor Yellow

$DatabaseUrl = Read-Host "`nPlease paste your FULL Supabase Connection String (e.g., postgresql://postgres.xyz...)"
if (-not $DatabaseUrl.StartsWith("postgresql://")) {
    Write-Error "Invalid connection string. It must start with postgresql://"
    exit 1
}

# 1. Run Database Migrations
Write-Host "`n[1/3] Running Database Migrations against the new Supabase project..." -ForegroundColor Green
$env:DATABASE_URL = $DatabaseUrl
Push-Location .\backend
try {
    python -m alembic upgrade head
} finally {
    Pop-Location
}
Write-Host "Migrations completed successfully!" -ForegroundColor Green

# 2. Setup Vercel Project
Write-Host "`n[2/4] Linking new Vercel Project..." -ForegroundColor Green
if (Test-Path .vercel) {
    Write-Host "Removing old Vercel link..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .vercel
}
Write-Host "Please follow the prompts to link or create the new Vercel project." -ForegroundColor Yellow
npx vercel link

# 3. Update Vercel Environment Variables
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

# 4. Deploy to Vercel
Write-Host "`n[4/4] Deploying to Vercel Production..." -ForegroundColor Green
npx vercel deploy --prod

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete! " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

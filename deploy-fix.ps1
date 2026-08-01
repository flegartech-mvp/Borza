$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Borza Final Deployment Fix Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. Ask for Database Password securely
Write-Host "`nYour previous password was incorrect. If you don't know it, please reset it in the Supabase Dashboard first!" -ForegroundColor Yellow
$Password = Read-Host "Please enter your CORRECT Supabase Database Password (input is hidden)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

# URL Encode the password to handle special characters
Add-Type -AssemblyName System.Web
$EncodedPassword = [System.Web.HttpUtility]::UrlEncode($PlainPassword)

$DatabaseUrl = "postgresql://postgres.opluurqiaoszhqwdzthk:$EncodedPassword@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

# 2. Run Database Migrations
Write-Host "`n[1/3] Running Database Migrations against Supabase..." -ForegroundColor Green
$env:DATABASE_URL = $DatabaseUrl
Push-Location .\backend
try {
    python -m alembic upgrade head
} finally {
    Pop-Location
}
Write-Host "Migrations completed successfully!" -ForegroundColor Green

# 3. Update Vercel Environment Variables
Write-Host "`n[2/3] Updating Vercel Environment Variables..." -ForegroundColor Green
Write-Host "Setting correct DATABASE_URL in Vercel..." -ForegroundColor Cyan

# Remove the old bad password from production environment if it exists
try { npx vercel env rm DATABASE_URL production -y } catch { }

# Add the correct one
$DatabaseUrl | npx vercel env add DATABASE_URL production

# 4. Deploy to Vercel
Write-Host "`n[3/3] Deploying to Vercel Production..." -ForegroundColor Green
# Ensure we use the latest vercel.json by pulling any changes if needed
npx vercel deploy --prod

Write-Host "`n=========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete! " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

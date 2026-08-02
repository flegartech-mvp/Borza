$ErrorActionPreference = "Stop"

Write-Host "Starting Borza Academy locally (SQLite + FastAPI + Next.js)" -ForegroundColor Cyan
$env:ENVIRONMENT = "development"
$env:ACADEMY_ALLOW_DEMO_AUTH = "true"
$env:BORZA_STRICT_PUBLIC_ENV = "false"
$env:NEXT_PUBLIC_API_URL = "http://localhost:8000"

Write-Host "Validating authored Academy content..." -ForegroundColor Green
python .\scripts\validate_academy_content.py

Write-Host "Applying database migrations..." -ForegroundColor Green
Push-Location .\backend
try {
    python -m alembic upgrade head
} finally {
    Pop-Location
}

Write-Host "Starting FastAPI on port 8000..." -ForegroundColor Green
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory ".\backend"

Write-Host "Starting Next.js on port 3000..." -ForegroundColor Green
Start-Process -WindowStyle Hidden -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory ".\frontend"

Write-Host "`nBorza Academy is starting:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "Demo progress is browser-local unless Supabase Auth is configured." -ForegroundColor Yellow

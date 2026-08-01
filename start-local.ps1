$ErrorActionPreference = "Stop"

Write-Host "Starting Borza in local development mode (SQLite, polling)" -ForegroundColor Cyan

# Set environment variables for standalone mode
$env:REALTIME_ENABLED = "false"
$env:BORZA_STRICT_PUBLIC_ENV = "false"
$env:NEXT_PUBLIC_API_URL = "http://localhost:8000"

Write-Host "Applying database migrations..." -ForegroundColor Green
Push-Location .\backend
try {
    python -m alembic upgrade head
} finally {
    Pop-Location
}

# Start the Backend API
Write-Host "Starting Backend API on port 8000..." -ForegroundColor Green
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory ".\backend"

# Start the Ingestion Worker
Write-Host "Starting Ingestion Worker..." -ForegroundColor Green
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m app.workers.ingestion_worker" -WorkingDirectory ".\backend"

# Start the Scheduler
Write-Host "Starting Ingestion Scheduler..." -ForegroundColor Green
Start-Process -WindowStyle Hidden -FilePath "python" -ArgumentList "-m app.scheduler" -WorkingDirectory ".\backend"

# Start the Frontend
Write-Host "Starting Frontend on port 3000..." -ForegroundColor Green
Start-Process -WindowStyle Hidden -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory ".\frontend"

Write-Host "`nAll services started! You can access the app at:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "`nProcesses run in the background. Stop their Python and Node processes when finished." -ForegroundColor Yellow

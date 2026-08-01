$ErrorActionPreference = "Stop"

Write-Host "Starting Borza in local standalone mode (SQLite, No Redis)" -ForegroundColor Cyan

# Set environment variables for standalone mode
$env:REALTIME_ENABLED = "false"
$env:BORZA_STRICT_PUBLIC_ENV = "false"

# Start the Backend API
Write-Host "Starting Backend API on port 8000..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8000" -WorkingDirectory ".\backend"

# Start the Ingestion Worker
Write-Host "Starting Ingestion Worker..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m app.workers.ingestion_worker" -WorkingDirectory ".\backend"

# Start the Scheduler
Write-Host "Starting Ingestion Scheduler..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m app.scheduler" -WorkingDirectory ".\backend"

# Start the Frontend
Write-Host "Starting Frontend on port 3000..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run start" -WorkingDirectory ".\frontend"

Write-Host "`nAll services started! You can access the app at:" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "Backend API: http://localhost:8000" -ForegroundColor White
Write-Host "`nPress Ctrl+C to exit and then you may need to manually close the background Python/Node processes." -ForegroundColor Yellow

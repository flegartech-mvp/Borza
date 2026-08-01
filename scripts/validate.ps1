param(
    [switch]$NativeFailureSelfTest
)

$ErrorActionPreference = "Stop"

function Invoke-CheckedNativeCommand {
    param(
        [Parameter(Mandatory = $true, Position = 0)]
        [string]$FilePath,

        [Parameter(Position = 1)]
        [string[]]$ArgumentList = @()
    )

    & $FilePath @ArgumentList
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "$FilePath failed with native exit code $exitCode."
    }
}

if ($NativeFailureSelfTest) {
    $failureCommand = if ($env:OS -eq "Windows_NT") { "cmd.exe" } else { "/bin/sh" }
    $failureArguments = if ($env:OS -eq "Windows_NT") {
        @("/d", "/c", "exit /b 9")
    } else {
        @("-c", "exit 9")
    }
    $failureDetected = $false
    try {
        Invoke-CheckedNativeCommand $failureCommand $failureArguments
    } catch {
        if ($_.Exception.Message -notmatch "native exit code 9") {
            throw
        }
        $failureDetected = $true
    }
    if (-not $failureDetected) {
        throw "Native command failure self-test did not detect exit code 9."
    }
    Write-Output "Native command failure propagation verified."
    exit 0
}

$root = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $root "backend")
try {
    $validationDatabasePath = [IO.Path]::GetTempFileName()
    $validationDatabaseUrl = "sqlite:///$($validationDatabasePath.Replace('\', '/'))"
    $savedEnvironment = $env:ENVIRONMENT
    $savedDatabaseUrl = $env:DATABASE_URL
    $savedMigrationDatabaseUrl = $env:MIGRATION_DATABASE_URL
    $savedPostgresTestDatabaseUrl = $env:POSTGRES_TEST_DATABASE_URL
    $savedValkeyTestUrl = $env:VALKEY_TEST_URL
    try {
        $env:ENVIRONMENT = "development"
        $env:DATABASE_URL = $validationDatabaseUrl
        $env:MIGRATION_DATABASE_URL = $validationDatabaseUrl
        $env:POSTGRES_TEST_DATABASE_URL = $null
        $env:VALKEY_TEST_URL = $null
        Invoke-CheckedNativeCommand "python" @("-m", "ruff", "format", "--check", ".")
        Invoke-CheckedNativeCommand "python" @("-m", "ruff", "check", ".")
        Invoke-CheckedNativeCommand "python" @(
            "-m",
            "pytest",
            "--cov=app",
            "--cov-report=term-missing"
        )
        Invoke-CheckedNativeCommand "python" @(
            "-m",
            "pytest",
            (Join-Path $root "premium/ai-trading-bot/tests"),
            "-q"
        )
        Invoke-CheckedNativeCommand "python" @("-m", "alembic", "upgrade", "head")
    } finally {
        $env:ENVIRONMENT = $savedEnvironment
        $env:DATABASE_URL = $savedDatabaseUrl
        $env:MIGRATION_DATABASE_URL = $savedMigrationDatabaseUrl
        $env:POSTGRES_TEST_DATABASE_URL = $savedPostgresTestDatabaseUrl
        $env:VALKEY_TEST_URL = $savedValkeyTestUrl
        Remove-Item -LiteralPath $validationDatabasePath -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath "$validationDatabasePath-journal" -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath "$validationDatabasePath-shm" -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath "$validationDatabasePath-wal" -Force -ErrorAction SilentlyContinue
    }
} finally {
    Pop-Location
}

Push-Location (Join-Path $root "frontend")
try {
    Invoke-CheckedNativeCommand "npm" @("ci")
    Invoke-CheckedNativeCommand "npm" @("run", "format:check")
    Invoke-CheckedNativeCommand "npm" @("run", "lint")
    Invoke-CheckedNativeCommand "npm" @("run", "typecheck")
    Invoke-CheckedNativeCommand "npm" @("run", "test:coverage")
    $savedStrictPublicEnv = $env:BORZA_STRICT_PUBLIC_ENV
    $savedPublicApiUrl = $env:NEXT_PUBLIC_API_URL
    $savedPublicWebSocketUrl = $env:NEXT_PUBLIC_WS_URL
    try {
        $env:BORZA_STRICT_PUBLIC_ENV = "true"
        $env:NEXT_PUBLIC_API_URL = "https://api.example.invalid"
        $env:NEXT_PUBLIC_WS_URL = "wss://api.example.invalid/ws/news"
        Invoke-CheckedNativeCommand "npm" @("run", "build")
    } finally {
        $env:BORZA_STRICT_PUBLIC_ENV = $savedStrictPublicEnv
        $env:NEXT_PUBLIC_API_URL = $savedPublicApiUrl
        $env:NEXT_PUBLIC_WS_URL = $savedPublicWebSocketUrl
    }
    Invoke-CheckedNativeCommand "npm" @("audit", "--omit=dev")
} finally {
    Pop-Location
}

Push-Location $root
try {
    if (-not $env:POSTGRES_PASSWORD) {
        $env:POSTGRES_PASSWORD = "compose-config-validation-only"
    }
    Invoke-CheckedNativeCommand "docker" @("compose", "config", "--quiet")
} finally {
    Pop-Location
}

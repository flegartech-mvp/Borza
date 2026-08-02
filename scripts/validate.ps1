param(
    [switch]$NativeFailureSelfTest,
    [switch]$SkipBrowser
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
    try {
        Invoke-CheckedNativeCommand $failureCommand $failureArguments
        throw "Native command failure self-test did not detect exit code 9."
    } catch {
        if ($_.Exception.Message -notmatch "native exit code 9") { throw }
    }
    Write-Output "Native command failure propagation verified."
    exit 0
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    Invoke-CheckedNativeCommand "python" @((Join-Path $repoRoot "scripts/validate_academy_content.py"))
    Invoke-CheckedNativeCommand "python" @("-m", "unittest", "scripts.test_validate_academy_content")
} finally {
    Pop-Location
}

Push-Location (Join-Path $repoRoot "backend")
try {
    $validationDatabasePath = [IO.Path]::GetTempFileName()
    $validationDatabaseUrl = "sqlite:///$($validationDatabasePath.Replace('\', '/'))"
    $savedValues = @{}
    foreach ($name in @(
        "ENVIRONMENT", "DATABASE_URL", "MIGRATION_DATABASE_URL",
        "POSTGRES_TEST_DATABASE_URL", "ACADEMY_ALLOW_DEMO_AUTH"
    )) {
        $savedValues[$name] = [Environment]::GetEnvironmentVariable($name)
    }
    try {
        $env:ENVIRONMENT = "test"
        $env:DATABASE_URL = $validationDatabaseUrl
        $env:MIGRATION_DATABASE_URL = $validationDatabaseUrl
        $env:POSTGRES_TEST_DATABASE_URL = $null
        $env:ACADEMY_ALLOW_DEMO_AUTH = "true"
        Invoke-CheckedNativeCommand "python" @("-m", "ruff", "format", "--check", ".")
        Invoke-CheckedNativeCommand "python" @("-m", "ruff", "check", ".")
        Invoke-CheckedNativeCommand "python" @("-m", "mypy", "app")
        Invoke-CheckedNativeCommand "python" @("-m", "pytest", "--cov=app", "--cov-report=term-missing")
        Invoke-CheckedNativeCommand "python" @("-m", "pytest", (Join-Path $repoRoot "premium/ai-trading-bot/tests"), "-q")
        Invoke-CheckedNativeCommand "python" @("-m", "alembic", "upgrade", "head")
        Invoke-CheckedNativeCommand "python" @("-m", "alembic", "current")
        Invoke-CheckedNativeCommand "python" @("-m", "alembic", "check")
    } finally {
        foreach ($name in $savedValues.Keys) {
            [Environment]::SetEnvironmentVariable($name, $savedValues[$name])
        }
        foreach ($suffix in @("", "-journal", "-shm", "-wal")) {
            [IO.File]::Delete("$validationDatabasePath$suffix")
        }
    }
} finally {
    Pop-Location
}

Push-Location (Join-Path $repoRoot "frontend")
try {
    Invoke-CheckedNativeCommand "npm" @("ci")
    Invoke-CheckedNativeCommand "npm" @("run", "format:check")
    Invoke-CheckedNativeCommand "npm" @("run", "lint")
    Invoke-CheckedNativeCommand "npm" @("run", "typecheck")
    Invoke-CheckedNativeCommand "npm" @("run", "test:coverage")

    $savedStrictPublicEnv = $env:BORZA_STRICT_PUBLIC_ENV
    $savedPublicApiUrl = $env:NEXT_PUBLIC_API_URL
    $savedSupabaseUrl = $env:NEXT_PUBLIC_SUPABASE_URL
    $savedSupabaseKey = $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    try {
        $env:BORZA_STRICT_PUBLIC_ENV = "true"
        $env:NEXT_PUBLIC_API_URL = "https://api.example.invalid"
        $env:NEXT_PUBLIC_SUPABASE_URL = $null
        $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $null
        Invoke-CheckedNativeCommand "npm" @("run", "build")
        if (-not $SkipBrowser) {
            Invoke-CheckedNativeCommand "npm" @("run", "test:e2e")
        }
    } finally {
        $env:BORZA_STRICT_PUBLIC_ENV = $savedStrictPublicEnv
        $env:NEXT_PUBLIC_API_URL = $savedPublicApiUrl
        $env:NEXT_PUBLIC_SUPABASE_URL = $savedSupabaseUrl
        $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $savedSupabaseKey
    }
    Invoke-CheckedNativeCommand "npm" @("audit", "--omit=dev")
} finally {
    Pop-Location
}

Push-Location $repoRoot
try {
    if (-not $env:POSTGRES_PASSWORD) {
        $env:POSTGRES_PASSWORD = "compose-config-validation-only"
    }
    Invoke-CheckedNativeCommand "docker" @("compose", "config", "--quiet")
    Invoke-CheckedNativeCommand "git" @("diff", "--check")
} finally {
    Pop-Location
}

param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonCommand = Get-Command python -CommandType Application -ErrorAction Stop
& $pythonCommand.Path (Join-Path $scriptRoot "package_bot.py") `
    --source $SourcePath `
    --output (Join-Path $scriptRoot "artifacts\borza-ai-trading-bot.zip")
$pythonExitCode = $LASTEXITCODE
if ($null -eq $pythonExitCode -or $pythonExitCode -ne 0) {
    throw "Package builder failed with exit code $pythonExitCode"
}

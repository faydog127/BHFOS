param(
    [Parameter(Mandatory=$true)]
    [string]$RootPath,

    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$folders = @(
    "01_Business",
    "02_Personal",
    "03_Financial",
    "04_Photos_Video",
    "05_AI_Projects",
    "06_Marketing",
    "07_Legal_Admin",
    "08_Backups",
    "09_Installers_Licenses"
)

if (-not (Test-Path -LiteralPath $RootPath)) {
    throw "RootPath does not exist: $RootPath"
}

foreach ($folder in $folders) {
    $target = Join-Path $RootPath $folder

    if ($Apply) {
        if (-not (Test-Path -LiteralPath $target)) {
            New-Item -ItemType Directory -Path $target | Out-Null
            Write-Host "Created: $target"
        } else {
            Write-Host "Already exists: $target"
        }
    } else {
        Write-Host "Would create: $target"
    }
}

if (-not $Apply) {
    Write-Host ""
    Write-Host "Dry run only. Re-run with -Apply to create folders."
}

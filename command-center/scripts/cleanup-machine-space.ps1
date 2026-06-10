param(
  # Actually deletes. Without -Apply, prints a report only.
  [switch] $Apply,

  # Temp/Crash dumps: only delete files older than this many days (default 3).
  [int] $TempMinAgeDays = 3,

  # If set, deletes these caches (safe, but will force re-downloads later).
  [switch] $CleanNpmCache,
  [switch] $CleanPlaywrightCache,

  # If set, deletes TEMP and CrashDumps contents older than TempMinAgeDays.
  [switch] $CleanTemp,
  [switch] $CleanCrashDumps
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function GB([double] $n) { if ($null -eq $n) { return 0 } ; [math]::Round(($n / 1GB), 2) }
function MB([double] $n) { if ($null -eq $n) { return 0 } ; [math]::Round(($n / 1MB), 1) }

function DirSize([string] $p) {
  if (-not (Test-Path -LiteralPath $p)) { return 0 }
  try {
    $m = Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
    if ($null -eq $m) { return 0 }
    $sum = $m.Sum
    if ($null -eq $sum) { return 0 }
    return $sum
  } catch {
    return 0
  }
}

function DriveFreeGB {
  $d = Get-PSDrive -Name C
  return [math]::Round(($d.Free / 1GB), 2)
}

function Remove-DirSafe([string] $p) {
  if (-not (Test-Path -LiteralPath $p)) { return }
  Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
}

function Remove-OldFilesInDir([string] $p, [int] $minAgeDays) {
  if (-not (Test-Path -LiteralPath $p)) { return }
  $cutoff = (Get-Date).AddDays(-1 * [math]::Max(0, $minAgeDays))
  Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
      try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop } catch { }
    }
}

$paths = [ordered]@{
  npm_cache = (Join-Path $env:LOCALAPPDATA "npm-cache")
  ms_playwright = (Join-Path $env:LOCALAPPDATA "ms-playwright")
  temp = (Join-Path $env:LOCALAPPDATA "Temp")
  crash_dumps = (Join-Path $env:LOCALAPPDATA "CrashDumps")
}

$before = [ordered]@{
  c_free_gb = (DriveFreeGB)
  npm_cache_gb = (GB (DirSize $paths.npm_cache))
  ms_playwright_gb = (GB (DirSize $paths.ms_playwright))
  temp_gb = (GB (DirSize $paths.temp))
  crash_dumps_gb = (GB (DirSize $paths.crash_dumps))
}

if (-not $Apply) {
  [ordered]@{
    apply = $false
    note = "Report only. Re-run with -Apply plus specific switches to delete."
    before = $before
    paths = $paths
    recommended_apply = "pwsh -File scripts/cleanup-machine-space.ps1 -Apply -CleanNpmCache -CleanPlaywrightCache -CleanTemp -CleanCrashDumps"
  } | ConvertTo-Json -Depth 4
  exit 0
}

if ($CleanNpmCache) { Remove-DirSafe $paths.npm_cache }
if ($CleanPlaywrightCache) { Remove-DirSafe $paths.ms_playwright }
if ($CleanTemp) { Remove-OldFilesInDir $paths.temp $TempMinAgeDays }
if ($CleanCrashDumps) { Remove-OldFilesInDir $paths.crash_dumps $TempMinAgeDays }

$after = [ordered]@{
  c_free_gb = (DriveFreeGB)
  npm_cache_gb = (GB (DirSize $paths.npm_cache))
  ms_playwright_gb = (GB (DirSize $paths.ms_playwright))
  temp_gb = (GB (DirSize $paths.temp))
  crash_dumps_gb = (GB (DirSize $paths.crash_dumps))
}

[ordered]@{
  apply = $true
  before = $before
  after = $after
  temp_min_age_days = $TempMinAgeDays
} | ConvertTo-Json -Depth 4

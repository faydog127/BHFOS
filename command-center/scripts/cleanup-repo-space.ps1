param(
  # Actually deletes files. Without -Apply, this script only reports what it would remove.
  [switch] $Apply,

  # Only delete items older than this many days (default: 14).
  [int] $MinAgeDays = 14,

  # Optional: include `node_modules` in candidates (not recommended unless you plan to reinstall).
  [switch] $IncludeNodeModules
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-AgeDays([datetime] $dt) {
  return [math]::Floor(((Get-Date) - $dt).TotalDays)
}

function Assert-WithinRoot {
  param(
    [Parameter(Mandatory = $true)][string] $Root,
    [Parameter(Mandatory = $true)][string] $Path
  )

  $r = ([IO.Path]::GetFullPath($Root)).TrimEnd("\")
  $p = ([IO.Path]::GetFullPath($Path))
  if (-not ($p.StartsWith($r, [System.StringComparison]::OrdinalIgnoreCase))) {
    throw "Refusing to operate outside repo root. root=$r path=$p"
  }
}

function Get-FileSizeBytes {
  param([Parameter(Mandatory = $true)][string] $Path)
  try { return (Get-Item -LiteralPath $Path -ErrorAction Stop).Length } catch { return 0 }
}

function Get-DirSizeBytes {
  param([Parameter(Mandatory = $true)][string] $Path)
  if (-not (Test-Path -LiteralPath $Path)) { return 0 }
  return (Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Sum Length).Sum
}

function To-MB([double] $bytes) {
  if ($null -eq $bytes) { return 0 }
  return [math]::Round(($bytes / 1MB), 1)
}

$root = Get-RepoRoot

$protected = @(
  (Join-Path $root "tmp\\730 Scott"),
  (Join-Path $root "tmp\\outgoing-email")
)

function Is-ProtectedPath {
  param([Parameter(Mandatory = $true)][string] $Path)
  $full = ([IO.Path]::GetFullPath($Path))
  foreach ($pp in $protected) {
    if ([string]::IsNullOrWhiteSpace($pp)) { continue }
    $pfull = ([IO.Path]::GetFullPath($pp))
    if ($full.StartsWith($pfull, [System.StringComparison]::OrdinalIgnoreCase)) { return $true }
  }
  return $false
}

$minAge = [math]::Max(0, $MinAgeDays)

$candidates = @()

# 1) Large tmp HTML artifacts (known to accumulate)
$tmp = Join-Path $root "tmp"
if (Test-Path -LiteralPath $tmp) {
  $pattern = "tvg-implemented-quote-sample-*.html"
  Get-ChildItem -LiteralPath $tmp -File -Filter $pattern -ErrorAction SilentlyContinue |
    Where-Object { (Get-AgeDays $_.LastWriteTime) -ge $minAge } |
    ForEach-Object {
      $candidates += [pscustomobject]@{
        kind = "file"
        path = $_.FullName
        mb = (To-MB $_.Length)
        age_days = (Get-AgeDays $_.LastWriteTime)
        last_write = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
        reason = "tmp quote sample artifact"
      }
    }
}

# 2) Old tmp dist-deploy scratch folders (only if older than MinAgeDays)
if (Test-Path -LiteralPath $tmp) {
  Get-ChildItem -LiteralPath $tmp -Directory -Filter "dist-deploy-*" -ErrorAction SilentlyContinue |
    Where-Object { (Get-AgeDays $_.LastWriteTime) -ge $minAge } |
    ForEach-Object {
      $size = Get-DirSizeBytes -Path $_.FullName
      $candidates += [pscustomobject]@{
        kind = "dir"
        path = $_.FullName
        mb = (To-MB $size)
        age_days = (Get-AgeDays $_.LastWriteTime)
        last_write = $_.LastWriteTime.ToString("yyyy-MM-dd HH:mm")
        reason = "tmp dist-deploy scratch"
      }
    }
}

# 3) Optionally reclaim node_modules (safe but requires reinstall)
if ($IncludeNodeModules) {
  $nm = Join-Path $root "node_modules"
  if (Test-Path -LiteralPath $nm) {
    $size = Get-DirSizeBytes -Path $nm
    $candidates += [pscustomobject]@{
      kind = "dir"
      path = $nm
      mb = (To-MB $size)
      age_days = (Get-AgeDays (Get-Item -LiteralPath $nm).LastWriteTime)
      last_write = (Get-Item -LiteralPath $nm).LastWriteTime.ToString("yyyy-MM-dd HH:mm")
      reason = "node_modules (requires npm install to restore)"
    }
  }
}

# Remove protected paths from candidate list
$candidates = @($candidates | Where-Object { -not (Is-ProtectedPath -Path $_.path) })

$totalMb = ($candidates | Measure-Object -Sum mb).Sum
if ($null -eq $totalMb) { $totalMb = 0 }

$summary = [ordered]@{
  repo_root = $root
  apply = [bool]$Apply
  min_age_days = $minAge
  protected_paths = @($protected)
  candidate_count = $candidates.Count
  candidate_total_mb = [math]::Round($totalMb, 1)
  candidates = @($candidates | Sort-Object mb -Descending)
}

if (-not $Apply) {
  $summary | ConvertTo-Json -Depth 6
  exit 0
}

foreach ($c in $candidates) {
  Assert-WithinRoot -Root $root -Path $c.path
  if (Is-ProtectedPath -Path $c.path) { continue }

  if ($c.kind -eq "file") {
    if (Test-Path -LiteralPath $c.path) {
      Remove-Item -LiteralPath $c.path -Force -ErrorAction Stop
    }
    continue
  }

  if ($c.kind -eq "dir") {
    if (Test-Path -LiteralPath $c.path) {
      Remove-Item -LiteralPath $c.path -Recurse -Force -ErrorAction Stop
    }
    continue
  }
}

$summary | ConvertTo-Json -Depth 6


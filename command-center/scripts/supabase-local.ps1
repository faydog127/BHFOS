param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('start', 'stop', 'restart', 'status', 'reset')]
  [string]$Command,

  [switch]$SupabaseDebug
)

$ErrorActionPreference = 'Stop'

function Resolve-SupabaseCli {
  $cmd = Get-Command supabase -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $candidate = Join-Path $env:USERPROFILE '.supabase\bin\supabase.exe'
  if (Test-Path $candidate) { return $candidate }

  throw "Supabase CLI not found. Install it, or add it to PATH. Expected at: $candidate"
}

$workdir = Split-Path $PSScriptRoot -Parent
$supabase = Resolve-SupabaseCli

$baseArgs = @('--workdir', $workdir)
if ($SupabaseDebug) { $baseArgs += '--debug' }

function Invoke-LocalBootstrap {
  $bootstrap = Join-Path $workdir 'scripts\bootstrap_local_dispatch_users.mjs'
  if (-not (Test-Path $bootstrap)) { return }

  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Host "WARN: node not found; skipping local auth bootstrap ($bootstrap)." -ForegroundColor Yellow
    return
  }

  Push-Location $workdir
  try {
    node scripts/bootstrap_local_dispatch_users.mjs | Out-Null
    Write-Host "OK: local auth bootstrap applied (bootstrap_local_dispatch_users.mjs)." -ForegroundColor Green
  } catch {
    Write-Host "WARN: local auth bootstrap failed (non-blocking). Details: $($_.Exception.Message)" -ForegroundColor Yellow
  } finally {
    Pop-Location
  }
}

switch ($Command) {
  'start' {
    & $supabase @baseArgs start --exclude logflare
    Invoke-LocalBootstrap
    break
  }
  'stop' {
    & $supabase @baseArgs stop --no-backup
    break
  }
  'restart' {
    & $supabase @baseArgs stop --no-backup
    & $supabase @baseArgs start --exclude logflare
    Invoke-LocalBootstrap
    break
  }
  'status' {
    & $supabase @baseArgs status
    break
  }
  'reset' {
    & $supabase @baseArgs db reset --yes
    Invoke-LocalBootstrap
    break
  }
}

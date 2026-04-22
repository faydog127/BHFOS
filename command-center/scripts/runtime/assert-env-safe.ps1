param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('local', 'staging', 'prod-readonly')]
  [string]$Environment,

  [string]$ProdSupabaseUrlHint,

  [switch]$AllowRemoteWrites
)

$ErrorActionPreference = 'Stop'

function Fail([string]$Message) {
  Write-Host "BLOCKED: $Message" -ForegroundColor Red
  exit 2
}

function Resolve-SupabaseCli {
  $cmd = Get-Command supabase -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }
  $candidate = Join-Path $env:USERPROFILE '.supabase\bin\supabase.exe'
  if (Test-Path $candidate) { return $candidate }
  Fail "Supabase CLI not found (expected at $candidate)."
}

function Parse-EnvOutput {
  param([string[]]$Lines)
  $map = @{}
  foreach ($line in $Lines) {
    if ($line -match '^[A-Z0-9_]+=' ) {
      $parts = $line.Split('=', 2)
      $key = $parts[0]
      $val = $parts[1].Trim()
      if ($val.StartsWith('"') -and $val.EndsWith('"')) {
        $val = $val.Substring(1, $val.Length - 2)
      }
      $map[$key] = $val
    }
  }
  return $map
}

if ($Environment -eq 'local') {
  $supabase = Resolve-SupabaseCli
  $workdir = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
  Push-Location $workdir
  try {
    $envLines = & $supabase status -o env 2>&1
  } finally {
    Pop-Location
  }

  $envMap = Parse-EnvOutput -Lines $envLines
  $functionsUrl = $envMap['FUNCTIONS_URL']
  if (-not $functionsUrl) {
    $apiUrl = $envMap['API_URL']
    if ($apiUrl) {
      $functionsUrl = ($apiUrl.TrimEnd('/') + '/functions/v1')
    }
  }
  if (-not $functionsUrl) { Fail "LOCAL preflight: FUNCTIONS_URL not found in supabase status (and API_URL missing). Run: supabase status -o env" }

  if ($functionsUrl -notmatch '^https?://(127\.0\.0\.1|localhost)') {
    Fail "LOCAL preflight: FUNCTIONS_URL is not localhost/127.0.0.1 ($functionsUrl)."
  }

  $edge = docker ps --format "{{.Names}}" | Where-Object { $_ -match '^supabase_edge_runtime_' } | Select-Object -First 1
  if (-not $edge) {
    Fail "LOCAL preflight: Supabase edge runtime container is not running (expected supabase_edge_runtime_*). Fix: run `pwsh -File scripts/supabase-local.ps1 -Command restart`, then re-run."
  }

  Write-Host "OK: local environment gates passed (FUNCTIONS_URL is local)." -ForegroundColor Green
  exit 0
}

if ($Environment -eq 'staging') {
  if (-not $AllowRemoteWrites) {
    Fail "STAGING requires -AllowRemoteWrites (explicit acknowledgement)."
  }
  if (-not $env:SUPABASE_URL) {
    Fail "STAGING requires SUPABASE_URL to be set in the environment."
  }
  if ($ProdSupabaseUrlHint -and ($env:SUPABASE_URL -eq $ProdSupabaseUrlHint)) {
    Fail "STAGING SUPABASE_URL matches the provided prod hint. Refusing to run staging writes against prod."
  }
  Write-Host "OK: staging gates passed (remote writes explicitly allowed; SUPABASE_URL present)." -ForegroundColor Green
  exit 0
}

if ($Environment -eq 'prod-readonly') {
  if ($AllowRemoteWrites) {
    Fail "PROD-READONLY cannot be used with -AllowRemoteWrites."
  }
  Write-Host "OK: prod-readonly gates passed (writes disabled by contract)." -ForegroundColor Green
  exit 0
}

Fail "Unknown environment."

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('local', 'staging', 'prod-readonly')]
  [string]$Environment,

  [ValidateSet('preflight', 'probes', 'chainA')]
  [string]$StopAfter = 'probes',

  [string]$TenantId = 'tvg',

  [switch]$IncludeStripeLocal,
  [switch]$AllowRemoteWrites,

  [string]$ProdSupabaseUrlHint,

  [switch]$SkipLocalSupabaseStart
)

$ErrorActionPreference = 'Stop'

function New-RunId {
  return ("rvh_" + [Guid]::NewGuid().ToString("N").Substring(0, 10))
}

function Redact-Text([string]$Text) {
  if (-not $Text) { return "" }
  $t = $Text
  $t = $t -replace '(Authorization:\\s*Bearer)\\s+[^\\s\\r\\n]+', '$1 [REDACTED]'
  $t = $t -replace '(apikey:\\s*)[^\\s\\r\\n]+', '$1[REDACTED]'
  $t = $t -replace '\"apikey\"\\s*:\\s*\"[^\"]+\"', '\"apikey\":\"[REDACTED]\"'
  $t = $t -replace '\"Authorization\"\\s*:\\s*\"Bearer\\s+[^\"]+\"', '\"Authorization\":\"Bearer [REDACTED]\"'
  $t = $t -replace '\\beyJ[a-zA-Z0-9_\\-\\.]+\\b', '[REDACTED_JWT]'
  $t = $t -replace '\\bsb_publishable_[A-Za-z0-9_\\-]+\\b', '[REDACTED_SB_PUBLISHABLE]'
  $t = $t -replace '\\bsb_secret_[A-Za-z0-9_\\-]+\\b', '[REDACTED_SB_SECRET]'
  $t = $t -replace '(JWT_SECRET|SECRET_KEY|PUBLISHABLE_KEY|S3_PROTOCOL_ACCESS_KEY_ID|S3_PROTOCOL_ACCESS_KEY_SECRET)=\"[^\"]+\"', '$1=\"[REDACTED]\"'
  $t = $t -replace '\\bpostgresql://[^\\s\\r\\n]+', 'postgresql://[REDACTED]'
  return $t
}

function Write-ArtifactIndexLine([string]$IndexPath, [string]$Line) {
  Add-Content -Path $IndexPath -Value $Line -Encoding UTF8
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path

function Invoke-Child {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter()][string[]]$Args = @()
  )
  $out = & $FilePath @Args 2>&1 | Out-String
  return @{
    exit_code = $LASTEXITCODE
    output = $out
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$date = Get-Date -Format 'yyyy-MM-dd'
$runId = New-RunId
$baseDir = Join-Path $repoRoot ("tmp\\runtime\\$date\\$Environment\\$runId")
New-Item -ItemType Directory -Force -Path $baseDir | Out-Null

$artifactIndex = Join-Path $baseDir 'artifacts_index.md'
Set-Content -Path $artifactIndex -Encoding UTF8 -Value "# RVH Artifacts Index`nGenerated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`nEnvironment: $Environment`nRun ID: $runId`n"

$runMeta = Join-Path $baseDir 'run.json'
@{
  run_id = $runId
  environment = $Environment
  started_at = (Get-Date).ToString('o')
  stop_after = $StopAfter
  tenant_id = $TenantId
} | ConvertTo-Json -Depth 6 | Set-Content -Path $runMeta -Encoding UTF8
Write-ArtifactIndexLine $artifactIndex ("- run.json -- proves: run metadata (no secrets)")

# ----------------
# Phase: Preflight
# ----------------
$preflightLog = Join-Path $baseDir 'preflight.log'
try {
  if ($Environment -eq 'local' -and -not $SkipLocalSupabaseStart) {
    $startResult = Invoke-Child -FilePath 'pwsh' -Args @(
      '-NoProfile',
      '-File',
      'scripts/supabase-local.ps1',
      '-Command',
      'restart'
    )
    $startOut = Redact-Text $startResult.output
    Set-Content -Path (Join-Path $baseDir 'local_supabase_start.log') -Encoding UTF8 -Value $startOut
    Write-ArtifactIndexLine $artifactIndex ("- local_supabase_start.log -- proves: local supabase start attempt (logflare excluded by script)")
  }

  $preflightArgs = @(
    '-NoProfile',
    '-File',
    (Join-Path $PSScriptRoot 'assert-env-safe.ps1'),
    '-Environment',
    $Environment
  )
  if ($ProdSupabaseUrlHint) { $preflightArgs += @('-ProdSupabaseUrlHint', $ProdSupabaseUrlHint) }
  if ($AllowRemoteWrites) { $preflightArgs += @('-AllowRemoteWrites') }

  $result = Invoke-Child -FilePath 'pwsh' -Args $preflightArgs

  $preflightOut = Redact-Text $result.output
  Set-Content -Path $preflightLog -Encoding UTF8 -Value $preflightOut

  if ($result.exit_code -ne 0) {
    throw "Preflight failed (exit_code=$($result.exit_code)). See preflight.log"
  }
} catch {
  $msg = Redact-Text ($_.Exception.Message)
  if (Test-Path $preflightLog) {
    Add-Content -Path $preflightLog -Encoding UTF8 -Value "`n$msg"
  } else {
    Set-Content -Path $preflightLog -Encoding UTF8 -Value $msg
  }
  throw
}
Write-ArtifactIndexLine $artifactIndex ("- preflight.log -- proves: environment safety gate result")

if ($StopAfter -eq 'preflight') {
  Write-Host "STOP_AFTER=preflight. See: $baseDir" -ForegroundColor Yellow
  exit 0
}

# ----------------
# Phase: Probes
# ----------------
$probesDir = Join-Path $baseDir 'probes'
New-Item -ItemType Directory -Force -Path $probesDir | Out-Null

function Run-Probe([string]$Name, [string]$Cmd, [string]$OutFile) {
  Write-Host "Running probe: $Name"
  # Run each probe in its own pwsh process so exit codes are reliable.
  $res = Invoke-Child -FilePath 'pwsh' -Args @('-NoProfile', '-Command', $Cmd)
  $code = $res.exit_code
  $sanitized = Redact-Text $res.output
  Set-Content -Path $OutFile -Encoding UTF8 -Value $sanitized
  return $code
}

if ($Environment -eq 'local') {
  $nowqLog = Join-Path $probesDir 'now-queue-smoke-test.log'
  $code1 = Run-Probe -Name 'now-queue-smoke-test' `
    -Cmd ("pwsh -NoProfile -File scripts/now-queue-smoke-test.ps1 -TenantId " + $TenantId + " -SkipStart") `
    -OutFile $nowqLog
  Write-ArtifactIndexLine $artifactIndex ("- probes/now-queue-smoke-test.log -- proves: local now_queue + task generation behavior")
  if ($code1 -ne 0) { Write-Host "Probe failed: now-queue-smoke-test (exit_code=$code1)" -ForegroundColor Red }

  $moneyLog = Join-Path $probesDir 'rvh-p0-a-revenue-chain.log'
  $code2 = Run-Probe -Name 'rvh-p0-a-revenue-chain' `
    -Cmd ("pwsh -NoProfile -File scripts/runtime/rvh-p0-a-revenue-chain.ps1 -TenantId " + $TenantId + " -SkipStart") `
    -OutFile $moneyLog
  Write-ArtifactIndexLine $artifactIndex ("- probes/rvh-p0-a-revenue-chain.log -- proves: local revenue chain (public-pay test bypass + webhook simulation)")
  if ($code2 -ne 0) { Write-Host "Probe failed: rvh-p0-a-revenue-chain (exit_code=$code2)" -ForegroundColor Red }

  if ($IncludeStripeLocal) {
    $stripeLog = Join-Path $probesDir 'stripe-intent-smoke-test.log'
    $code3 = Run-Probe -Name 'stripe-intent-smoke-test' `
      -Cmd ("pwsh -NoProfile -File scripts/stripe-intent-smoke-test.ps1 -TenantId " + $TenantId + " -SkipStart") `
      -OutFile $stripeLog
    Write-ArtifactIndexLine $artifactIndex ("- probes/stripe-intent-smoke-test.log -- proves: local public-pay initiation (requires STRIPE_SECRET_KEY configured in local supabase secrets)")
    if ($code3 -ne 0) { Write-Host "Probe failed: stripe-intent-smoke-test (exit_code=$code3)" -ForegroundColor Red }
  } else {
    $note = Join-Path $probesDir 'stripe-intent-skipped.txt'
    Set-Content -Path $note -Encoding UTF8 -Value "Skipped (IncludeStripeLocal not set). This probe requires STRIPE_SECRET_KEY in local Supabase secrets."
    Write-ArtifactIndexLine $artifactIndex ("- probes/stripe-intent-skipped.txt -- proves: stripe intent probe intentionally skipped")
  }
}

if ($Environment -eq 'staging') {
  $stgLog = Join-Path $probesDir 'prove-a-exec-2-staging.log'
  # Default to NO_STRIPE=1 unless explicitly overridden in the environment.
  if (-not $env:NO_STRIPE) { $env:NO_STRIPE = '1' }
  $codeS = Run-Probe -Name 'prove-a-exec-2-staging' `
    -Cmd ("node scripts/prove-a-exec-2-staging.mjs") `
    -OutFile $stgLog
  Write-ArtifactIndexLine $artifactIndex ("- probes/prove-a-exec-2-staging.log -- proves: staging edge+rest probes (may skip Stripe if NO_STRIPE=1)")
  if ($codeS -ne 0) { Write-Host "Probe failed: prove-a-exec-2-staging (exit_code=$codeS)" -ForegroundColor Red }
}

if ($Environment -eq 'prod-readonly') {
  $note = Join-Path $probesDir 'prod_readonly_note.txt'
  Set-Content -Path $note -Encoding UTF8 -Value "PROD-READONLY: No write probes executed. Use ULSIA artifacts (schema dump, config reads, log reads) only."
  Write-ArtifactIndexLine $artifactIndex ("- probes/prod_readonly_note.txt -- proves: prod-readonly mode avoided write probes by design")
}

if ($StopAfter -eq 'probes') {
  Write-Host "STOP_AFTER=probes. See: $baseDir" -ForegroundColor Yellow
  exit 0
}

# ----------------
# Phase: Chain A (Revenue)
# ----------------
$chainDir = Join-Path $baseDir 'chainA'
New-Item -ItemType Directory -Force -Path $chainDir | Out-Null

if ($Environment -eq 'local') {
  $chainLog = Join-Path $chainDir 'rvh-p0-a-revenue-chain.log'
  $codeA = Run-Probe -Name 'rvh-p0-a-revenue-chain' `
    -Cmd ("pwsh -NoProfile -File scripts/runtime/rvh-p0-a-revenue-chain.ps1 -TenantId " + $TenantId + " -SkipStart") `
    -OutFile $chainLog
  Write-ArtifactIndexLine $artifactIndex ("- chainA/rvh-p0-a-revenue-chain.log -- proves: local P0 revenue chain (public-invoice → public-pay → stripe-webhook bypass → DB assertions)")
  if ($codeA -ne 0) { Write-Host "Chain A failed: rvh-p0-a-revenue-chain (exit_code=$codeA)" -ForegroundColor Red }
} else {
  $chainNote = Join-Path $chainDir 'chainA_gated.txt'
  Set-Content -Path $chainNote -Encoding UTF8 -Value @"
Chain A (Revenue) is gated in $Environment.
- staging: requires explicit isolation (separate Supabase + n8n + Stripe test mode) before any writes
- prod-readonly: no writes allowed by contract
"@
  Write-ArtifactIndexLine $artifactIndex ("- chainA/chainA_gated.txt -- proves: revenue chain gated outside local")
}

Write-Host "Completed run. Artifacts: $baseDir" -ForegroundColor Green

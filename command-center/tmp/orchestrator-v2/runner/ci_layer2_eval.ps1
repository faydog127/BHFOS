param(
  [string]$TenantId = "vent-guys",
  [string]$BaselineBundleRoot = "",
  [string]$BaselineConfigPath = "./tmp/orchestrator-v2/baseline.json"
)

$ErrorActionPreference = "Stop"

function EnsureDir([string]$Path) {
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function CopyDir([string]$Src, [string]$Dst) {
  EnsureDir $Dst
  Copy-Item -Recurse -Force -Path (Join-Path $Src "*") -Destination $Dst
}

if (-not $BaselineBundleRoot -or $BaselineBundleRoot.Trim() -eq "") {
  if (Test-Path $BaselineConfigPath) {
    $cfg = Get-Content -Raw $BaselineConfigPath | ConvertFrom-Json
    if (-not $TenantId -or $TenantId.Trim() -eq "") {
      $TenantId = [string]$cfg.baseline_tenant_id
    }
    $runFolder = [string]$cfg.baseline_run_folder
    if (-not $runFolder -or $runFolder.Trim() -eq "") { throw "Invalid baseline config: missing baseline_run_folder" }
    $BaselineBundleRoot = "./artifacts/tenants/$TenantId/runs/$runFolder/observed_bundle"
  } else {
    $BaselineBundleRoot = "./artifacts/tenants/$TenantId/runs/2026-04-09T03-54-25.639Z/observed_bundle"
  }
}

if (-not (Test-Path $BaselineBundleRoot)) {
  throw "Missing baseline observed_bundle root: $BaselineBundleRoot"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("bhfos_layer2_ci_" + [Guid]::NewGuid().ToString("n"))
EnsureDir $tempRoot

try {
  Write-Host "Copying baseline bundle into temp workspace..."
  $bundleCopy = Join-Path $tempRoot "bundle"
  CopyDir $BaselineBundleRoot $bundleCopy

  Write-Host "Running Layer2 evaluator pipeline (evaluate-only) on baseline bundle..."
  & pwsh -NoProfile -File ./tmp/orchestrator-v2/runner/run_layer2_pipeline.ps1 -Mode evaluate -BundleRoot $bundleCopy | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "Layer2 pipeline failed with exit_code=$LASTEXITCODE" }

  Write-Host "CI Layer2 evaluation: PASS"
} finally {
  try { Remove-Item -Recurse -Force -LiteralPath $tempRoot 2>$null } catch { }
}

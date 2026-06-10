param(
  # Actually applies changes. Without -Apply, prints what would change.
  [switch] $Apply,

  # Disable SmartByte services (recommended).
  [switch] $DisableSmartByte = $true,

  # Disable Adobe Creative Cloud experience (CCXProcess) at login (recommended).
  [switch] $DisableAdobeCCX = $true,

  # Disable Adobe Acrobat/Reader collaboration synchronizers at login (recommended).
  [switch] $DisableAdobeSync = $true,

  # Disable Microsoft Teams auto-start (recommended if you don’t use Teams daily).
  [switch] $DisableTeams = $true,

  # Leave these off by default (often needed):
  [switch] $DisableDockerDesktop = $false,
  [switch] $DisableOneDrive = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir([string] $p) { if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p | Out-Null } }

function Now-Slug { (Get-Date).ToString("yyyyMMdd-HHmmss") }

function Read-RunKey([string] $keyPath) {
  $out = @{}
  try {
    $props = Get-ItemProperty -LiteralPath $keyPath -ErrorAction Stop
    foreach ($p in $props.PSObject.Properties) {
      if ($p.Name -in 'PSPath','PSParentPath','PSChildName','PSDrive','PSProvider') { continue }
      $out[$p.Name] = [string]$p.Value
    }
  } catch {
    # ignore
  }
  return $out
}

function Remove-RunValue([string] $keyPath, [string] $name) {
  try {
    Remove-ItemProperty -LiteralPath $keyPath -Name $name -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Get-ServiceCimSafe([string] $serviceName) {
  try {
    return Get-CimInstance Win32_Service -Filter ("Name='{0}'" -f ($serviceName.Replace("'", "''")))
  } catch {
    return $null
  }
}

function Disable-ServiceSafe([string] $serviceName) {
  $result = [ordered]@{ name = $serviceName; ok = $false; error = '' }
  try {
    $svc = Get-Service -Name $serviceName -ErrorAction Stop

    if ($svc.Status -eq 'Running') {
      Stop-Service -Name $serviceName -Force -ErrorAction Stop
    }

    Set-Service -Name $serviceName -StartupType Disabled -ErrorAction Stop

    $cim = Get-ServiceCimSafe -serviceName $serviceName
    if ($cim -and $cim.StartMode -eq 'Disabled' -and $cim.State -ne 'Running') {
      $result.ok = $true
      return $result
    }

    $result.error = "Service did not reflect Disabled/Stopped after update (StartMode=$($cim.StartMode) State=$($cim.State))."
    return $result
  } catch {
    $result.error = ($_.Exception.Message)
    return $result
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backupDir = Join-Path $repoRoot "tmp\\startup-backups"
Ensure-Dir $backupDir
$backupPath = Join-Path $backupDir ("startup-backup-{0}.json" -f (Now-Slug))

$runKey = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"
$beforeRun = Read-RunKey $runKey

$targets = @()
if ($DisableAdobeSync) {
  $targets += "Adobe Acrobat Synchronizer"
  $targets += "Adobe Reader Synchronizer"
}
if ($DisableAdobeCCX) { $targets += "CCXProcess" }
if ($DisableTeams) { $targets += "Teams" }
if ($DisableDockerDesktop) { $targets += "Docker Desktop" }
if ($DisableOneDrive) { $targets += "OneDrive" }

$plannedRunChanges = @()
foreach ($t in ($targets | Select-Object -Unique)) {
  if ($beforeRun.ContainsKey($t)) {
    $plannedRunChanges += [pscustomobject]@{ type="registry_run"; key=$runKey; name=$t; action="remove"; value=$beforeRun[$t] }
  }
}

$plannedServiceChanges = @()
if ($DisableSmartByte) {
  # These service *names* appear to include spaces on this machine.
  $smartByteCandidates = @(
    "SmartByte Analytics Service",
    "SmartByte Network Service x64"
  )
  foreach ($n in $smartByteCandidates) {
    $plannedServiceChanges += [pscustomobject]@{ type="service"; name=$n; action="disable_and_stop" }
  }
}

$plan = [ordered]@{
  apply = [bool]$Apply
  backup_path = $backupPath
  registry_run_changes = @($plannedRunChanges)
  service_changes = @($plannedServiceChanges)
  notes = @(
    "This only removes auto-start entries for the current Windows user (HKCU Run) and disables SmartByte services.",
    "No files are deleted. A backup of the HKCU Run key values is written into the repo for rollback."
  )
}

if (-not $Apply) {
  $plan | ConvertTo-Json -Depth 6
  exit 0
}

# Backup the entire HKCU Run key values for rollback.
@{
  captured_at = (Get-Date).ToString("o")
  user = (whoami)
  hkcu_run = $beforeRun
} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $backupPath -Encoding utf8

$applied = [ordered]@{
  registry_run_removed = @()
  services_disabled = @()
  registry_run_missing = @()
  service_missing_or_failed = @()
}

foreach ($c in $plannedRunChanges) {
  if (Remove-RunValue -keyPath $runKey -name $c.name) { $applied.registry_run_removed += $c.name }
  else { $applied.registry_run_missing += $c.name }
}

foreach ($s in $plannedServiceChanges) {
  $r = Disable-ServiceSafe -serviceName $s.name
  if ($r.ok) { $applied.services_disabled += $s.name }
  else { $applied.service_missing_or_failed += [pscustomobject]@{ name=$s.name; error=$r.error } }
}

$afterRun = Read-RunKey $runKey

[ordered]@{
  ok = $true
  backup_path = $backupPath
  applied = $applied
  remaining_hkcu_run_keys = @($afterRun.Keys | Sort-Object)
} | ConvertTo-Json -Depth 6

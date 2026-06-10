param(
  [string] $Out,
  [string] $JsonOut,
  [switch] $IncludeUntracked,
  [switch] $NoExternalTis
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-TimestampSlug {
  return (Get-Date).ToString("yyyyMMdd-HHmmss")
}

function Try-Exec {
  param(
    [Parameter(Mandatory = $true)][string] $FilePath,
    [Parameter(Mandatory = $true)][string[]] $Args
  )

  try {
    return & $FilePath @Args 2>$null
  } catch {
    return $null
  }
}

function Ensure-Dir {
  param([Parameter(Mandatory = $true)][string] $Dir)
  if (-not (Test-Path -LiteralPath $Dir)) {
    New-Item -ItemType Directory -Path $Dir | Out-Null
  }
}

function Get-CommandCenterRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-GitInfo {
  param([Parameter(Mandatory = $true)][string] $CommandCenterRoot)

  $git = (Get-Command git -ErrorAction SilentlyContinue)
  if (-not $git) {
    return @{
      hasGit = $false
    }
  }

  $top = Try-Exec -FilePath $git.Source -Args @("-C", $CommandCenterRoot, "rev-parse", "--show-toplevel")
  $prefix = Try-Exec -FilePath $git.Source -Args @("-C", $CommandCenterRoot, "rev-parse", "--show-prefix")
  if (-not $top) {
    return @{
      hasGit = $false
    }
  }

  $prefixValue = ""
  if ($prefix) { $prefixValue = ($prefix | Select-Object -Last 1).Trim() }

  return @{
    hasGit = $true
    gitExe = $git.Source
    topLevel = ($top | Select-Object -Last 1).Trim()
    prefix = $prefixValue
  }
}

function Normalize-RepoPath {
  param(
    [Parameter(Mandatory = $true)][string] $Path,
    [Parameter(Mandatory = $true)][string] $Prefix
  )

  $p = $Path.Replace("\", "/")
  $pref = ($Prefix ?? "").Replace("\", "/")
  if ($pref -and $p.StartsWith($pref)) {
    return $p.Substring($pref.Length)
  }
  return $p
}

function Get-WorkstreamForPath {
  param([Parameter(Mandatory = $true)][string] $RepoRelPath)

  $p = $RepoRelPath.Replace("\", "/")

  if ($p -eq "docker-compose.n8n.yml" -or $p -like "tools/n8n/*" -or $p -like "scripts/n8n-*" -or $p -like ".env.n8n*") { return "n8n" }
  if ($p -like "tmp/orchestrator-v2/*" -or $p -eq "tmp/orchestrator-v2") { return "orchestrator-v2" }
  if ($p -like "tmp/deploy-*" -or $p -like "tools/deploy-*" -or $p -eq "tools/deploy-lib.mjs" -or $p -eq "tools/compare-hostinger-live.mjs") { return "deploy" }
  if ($p -like "apps/tis/*" -or $p -like "docs/tis/*") { return "tis-boundary/docs" }
  if ($p -like "supabase/*") { return "supabase" }
  if ($p -like "src/*") { return "crm-app" }
  if ($p -like "docs/*") { return "docs/governance" }
  if ($p -like "scripts/*" -or $p -like "tools/*") { return "scripts/tools" }
  if ($p -like "tmp/*") { return "tmp" }
  return "other"
}

function Get-GitStatusItems {
  param(
    [Parameter(Mandatory = $true)][hashtable] $GitInfo,
    [Parameter(Mandatory = $true)][string] $CommandCenterRoot
  )

  if (-not $GitInfo.hasGit) { return @() }

  $raw = & $GitInfo.gitExe -C $CommandCenterRoot status --porcelain=v1 2>$null
  if (-not $raw) { return @() }

  $items = @()
  foreach ($line in $raw) {
    if (-not $line) { continue }
    if ($line.Length -lt 4) { continue }

    $status = $line.Substring(0, 2)
    $path = $line.Substring(3).Trim()
    if (-not $path) { continue }

    $repoRel = Normalize-RepoPath -Path $path -Prefix $GitInfo.prefix
    $items += [pscustomobject]@{
      status = $status
      path = $repoRel
      workstream = (Get-WorkstreamForPath -RepoRelPath $repoRel)
      isUntracked = ($status -eq "??")
    }
  }

  return $items
}

function Redact-PathForDisplay {
  param([Parameter(Mandatory = $true)][string] $RepoRelPath)

  $p = $RepoRelPath.Replace("\", "/")
  if ($p -like ".env*" -or $p -like "**/.env*" -or $p -like "*.pem" -or $p -like "*.pfx" -or $p -like "*.key") {
    return "<redacted-path>"
  }
  return $RepoRelPath
}

$commandCenterRoot = Get-CommandCenterRoot
$timestamp = Get-TimestampSlug

if (-not $Out) {
  $Out = Join-Path $commandCenterRoot ("tmp\\workstream-status\\workstream-status-{0}.md" -f $timestamp)
}
if (-not $JsonOut) {
  $JsonOut = Join-Path $commandCenterRoot ("tmp\\workstream-status\\workstream-status-{0}.json" -f $timestamp)
}

Ensure-Dir -Dir (Split-Path $Out -Parent)

$gitInfo = Get-GitInfo -CommandCenterRoot $commandCenterRoot
$items = Get-GitStatusItems -GitInfo $gitInfo -CommandCenterRoot $commandCenterRoot

$tracked = @($items | Where-Object { -not $_.isUntracked })
$untracked = @($items | Where-Object { $_.isUntracked })
if (-not $IncludeUntracked) {
  $untracked = @()
}

$byStream = @{}
foreach ($it in @($tracked + $untracked)) {
  if (-not $byStream.ContainsKey($it.workstream)) { $byStream[$it.workstream] = @() }
  $byStream[$it.workstream] += $it
}

# External TIS: only presence + git status file list (no file contents)
$externalTis = @{
  enabled = (-not $NoExternalTis)
  path = "C:\\BHFOS\\TIS"
  exists = $false
  isGitRepo = $false
  status = @()
}

if ($externalTis.enabled) {
  $externalTis.exists = Test-Path -LiteralPath $externalTis.path
  if ($externalTis.exists -and $gitInfo.hasGit) {
    $tisTop = Try-Exec -FilePath $gitInfo.gitExe -Args @("-C", $externalTis.path, "rev-parse", "--show-toplevel")
    if ($tisTop) {
      $externalTis.isGitRepo = $true
      $tisStatus = & $gitInfo.gitExe -C $externalTis.path status --porcelain=v1 2>$null
      if ($tisStatus) {
        # Hide env/keys by path redaction
        $externalTis.status = @(
          $tisStatus | ForEach-Object {
            $s = $_
            if (-not $s -or $s.Length -lt 4) { return }
            $st = $s.Substring(0, 2)
            $pp = $s.Substring(3).Trim()
            $ppSafe = (Redact-PathForDisplay -RepoRelPath $pp)
            "{0} {1}" -f $st, $ppSafe
          } | Where-Object { $_ }
        )
      }
    }
  }
}

$dockerExe = (Get-Command docker -ErrorAction SilentlyContinue)
$n8nEnvPresent = Test-Path -LiteralPath (Join-Path $commandCenterRoot ".env.n8n")

$tick = [char]96

$md = New-Object System.Collections.Generic.List[string]
$md.Add("# Workstream Status Snapshot")
$md.Add("")
$md.Add(("- Generated: {0} (local time)" -f (Get-Date)))
$md.Add(("- Command Center root: {0}{1}{0}" -f $tick, $commandCenterRoot))
if ($gitInfo.hasGit) {
  $md.Add(("- Git root: {0}{1}{0} (prefix: {0}{2}{0})" -f $tick, $gitInfo.topLevel, $gitInfo.prefix))
} else {
  $md.Add("- Git: not detected")
}
$md.Add("")
$md.Add("## Quick pointers")
$md.Add("")
$md.Add(("- Map: {0}docs/handoff/WORKSTREAMS.md{0}" -f $tick))
$md.Add(("- n8n runbook: {0}tools/n8n/README.md{0}" -f $tick))
$md.Add(("- TIS boundary rules: {0}apps/tis/AGENTS.md{0}" -f $tick))
$md.Add(("- Orchestrator v2 baseline: {0}docs/governance/BASELINE.md{0}" -f $tick))
$md.Add("")
$md.Add("## Git changes (this repo)")
$md.Add("")
if (($tracked.Count + $untracked.Count) -eq 0) {
  $md.Add("- No local changes detected.")
} else {
  foreach ($key in @($byStream.Keys | Sort-Object)) {
    $group = @($byStream[$key])
    if (-not $group -or $group.Count -eq 0) { continue }

    $md.Add(("### {0} ({1})" -f $key, $group.Count))
    foreach ($g in ($group | Sort-Object status, path)) {
      $safePath = Redact-PathForDisplay -RepoRelPath $g.path
      $md.Add(("- {0}{1}{0} {0}{2}{0}" -f $tick, $g.status.Trim(), $safePath))
    }
    $md.Add("")
  }

  if (-not $IncludeUntracked -and $items.Count -gt ($tracked.Count)) {
    $md.Add(("> Note: untracked files are hidden by default. Re-run with {0}-IncludeUntracked{0} if needed." -f $tick))
    $md.Add("")
  }
}

$md.Add("## n8n local readiness")
$md.Add("")
$md.Add(("- {0}docker{0} on PATH: {1}" -f $tick, $(if ($dockerExe) { "yes" } else { "no" })))
$md.Add(("- {0}.env.n8n{0} present: {1}" -f $tick, $(if ($n8nEnvPresent) { "yes" } else { "no (copy from .env.n8n.example)" })))
$md.Add(("- Start: {0}docker compose --env-file .env.n8n -f docker-compose.n8n.yml up -d{0}" -f $tick))
$md.Add(("- Editor: {0}http://localhost:5679{0} (default)" -f $tick))
$md.Add("")

$md.Add("## External TIS repo (disk)")
$md.Add("")
if (-not $externalTis.enabled) {
  $md.Add(("- Skipped (ran with {0}-NoExternalTis{0})." -f $tick))
} elseif (-not $externalTis.exists) {
  $md.Add(("- Not found: {0}{1}{0}" -f $tick, $externalTis.path))
} else {
  $md.Add(("- Found: {0}{1}{0}" -f $tick, $externalTis.path))
  $md.Add(("- Git repo detected: {0}" -f ($(if ($externalTis.isGitRepo) { "yes" } else { "no" }))))
  if ($externalTis.isGitRepo -and $externalTis.status.Count -gt 0) {
    $md.Add("")
    $md.Add("### TIS git status (file list only)")
    foreach ($line in $externalTis.status) {
      $md.Add(("- {0}{1}{0}" -f $tick, $line))
    }
  } elseif ($externalTis.isGitRepo) {
    $md.Add("- Clean (no changes) or unable to read status.")
  } else {
    $md.Add("- (Not a git repo or git not available.)")
  }
}
$md.Add("")

$mdText = ($md -join "`n")
Set-Content -LiteralPath $Out -Value $mdText -Encoding UTF8

$json = @{
  generated_at = (Get-Date).ToString("o")
  command_center_root = $commandCenterRoot
  git = $gitInfo
  include_untracked = [bool]$IncludeUntracked
  changes = @($tracked + $untracked) | ForEach-Object {
    @{
      status = $_.status
      path = $_.path
      workstream = $_.workstream
      is_untracked = [bool]$_.isUntracked
    }
  }
  n8n = @{
    docker_present = [bool]$dockerExe
    env_present = [bool]$n8nEnvPresent
  }
  external_tis = $externalTis
}

Ensure-Dir -Dir (Split-Path $JsonOut -Parent)
$json | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $JsonOut -Encoding UTF8

Write-Host "Wrote:"
Write-Host ("- {0}" -f $Out)
Write-Host ("- {0}" -f $JsonOut)

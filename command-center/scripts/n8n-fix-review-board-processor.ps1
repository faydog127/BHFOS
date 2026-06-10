param(
  [string] $BaseUrl = "https://bhfos.app.n8n.cloud",
  [string] $WorkflowId,
  [string] $WorkflowName = "Review Board Processor",
  [string] $ApiKey = $env:N8N_API_KEY,
  [switch] $DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Best-effort: load repo env files so users can keep N8N_API_KEY in `.env.local` (gitignored)
if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  try {
    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
    $envFiles = @(
      (Join-Path $repoRoot ".env.local"),
      (Join-Path $repoRoot ".env")
    )

    foreach ($file in $envFiles) {
      if (-not (Test-Path -LiteralPath $file)) { continue }
      Get-Content -LiteralPath $file | ForEach-Object {
        $line = $_
        if (-not $line) { return }
        $trimmed = $line.Trim()
        if (-not $trimmed) { return }
        if ($trimmed.StartsWith("#")) { return }
        if ($trimmed.StartsWith("export ")) { $trimmed = $trimmed.Substring(7).Trim() }

        $idx = $trimmed.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $trimmed.Substring(0, $idx).Trim()
        if (-not $key) { return }
        $value = $trimmed.Substring($idx + 1).Trim()
        if (($value.StartsWith('"') -and $value.EndsWith('"') -and $value.Length -ge 2) -or ($value.StartsWith("'") -and $value.EndsWith("'") -and $value.Length -ge 2)) {
          $value = $value.Substring(1, $value.Length - 2)
        }

        [Environment]::SetEnvironmentVariable($key, $value, "Process")
      }
    }
  } catch {
    # Ignore env load failures; we'll hard-fail if the key is still missing
  }
  $ApiKey = $env:N8N_API_KEY
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  throw "Missing N8N API key. Set `$env:N8N_API_KEY, add N8N_API_KEY=... to .env.local, or pass -ApiKey."
}

function Invoke-N8nJson {
  param(
    [Parameter(Mandatory = $true)][ValidateSet("GET","PUT","POST","DELETE")][string] $Method,
    [Parameter(Mandatory = $true)][string] $Path,
    [object] $Body
  )

  $uri = ($BaseUrl.TrimEnd("/") + $Path)
  $headers = @{
    "accept"         = "application/json"
    "X-N8N-API-KEY"  = $ApiKey
    "Content-Type"   = "application/json"
  }

  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
  }

  $json = $Body | ConvertTo-Json -Depth 100
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json
}

function Get-WorkflowList {
  $res = Invoke-N8nJson -Method GET -Path "/api/v1/workflows?limit=250"
  if ($res -is [array]) { return $res }
  if ($res.data) { return $res.data }
  return @()
}

function Get-WorkflowById([string] $Id) {
  return Invoke-N8nJson -Method GET -Path ("/api/v1/workflows/{0}" -f $Id)
}

function Update-Workflow([string] $Id, [object] $Workflow) {
  $body = [ordered]@{
    name        = $Workflow.name
    nodes       = $Workflow.nodes
    connections = $Workflow.connections
    settings    = $Workflow.settings
    staticData  = $Workflow.staticData
    active      = $Workflow.active
    tags        = $Workflow.tags
  }
  return Invoke-N8nJson -Method PUT -Path ("/api/v1/workflows/{0}" -f $Id) -Body $body
}

$validationJs = @'
const raw = ($json && typeof $json === 'object') ? ($json.body ?? $json) : {};

const ALL = ['artifact_name','source','current_stage','decision_needed','risk_level','main_concern','artifact_text'];
const REQUIRED = ['artifact_name','current_stage','artifact_text'];

const ALLOWED_STAGES = [
  'Concept',
  'Draft Workflow',
  'Operational Prototype',
  'Pre-Production Spec',
  'Production Candidate',
];

const normalized = {};
for (const k of ALL) {
  const v = raw?.[k];
  normalized[k] = (typeof v === 'string') ? v.trim() : (v == null ? '' : String(v).trim());
}

const missing_fields = REQUIRED.filter((k) => !normalized[k]);
const invalid_fields = [];

if (normalized.current_stage && !ALLOWED_STAGES.includes(normalized.current_stage)) invalid_fields.push('current_stage');

const LIMIT = 25000;
if (normalized.artifact_text && normalized.artifact_text.length > LIMIT) invalid_fields.push('artifact_text');

if (missing_fields.length || invalid_fields.length) {
  const tooLarge = invalid_fields.includes('artifact_text') && normalized.artifact_text.length > LIMIT;
  return [{
    json: {
      status: 'error',
      message: tooLarge ? 'Payload too large' : 'Invalid input',
      missing_fields,
      invalid_fields,
      http_code: 400,
      validation_passed: false,
    }
  }];
}

return [{
  json: {
    status: 'pass',
    validation_passed: true,
    ...normalized,
  }
}];
'@

Write-Host "Locating workflow…" -ForegroundColor Cyan

$wfId = $WorkflowId
if ([string]::IsNullOrWhiteSpace($wfId)) {
  $list = Get-WorkflowList
  $match = $list | Where-Object { $_.name -like "*$WorkflowName*" } | Select-Object -First 1
  if (-not $match) {
    throw "Workflow not found by name match: $WorkflowName"
  }
  $wfId = [string]$match.id
}

$wf = Get-WorkflowById $wfId
if (-not $wf -or -not $wf.nodes) { throw "Failed to fetch workflow $wfId" }

$nodes = @($wf.nodes)
$nodeByName = @{}
foreach ($n in $nodes) { $nodeByName[$n.name] = $n }

$webhook = $nodes | Where-Object { $_.type -eq "n8n-nodes-base.webhook" } | Select-Object -First 1
if (-not $webhook) { throw "Missing Webhook node" }

$respond = $nodes | Where-Object { $_.type -eq "n8n-nodes-base.respondToWebhook" } | Select-Object -First 1
if (-not $respond) { throw "Missing Respond to Webhook node" }

$validate = $nodes | Where-Object { $_.type -eq "n8n-nodes-base.code" -and $_.name -match "Validate" } | Select-Object -First 1
if (-not $validate) {
  $validate = $nodes | Where-Object { $_.type -eq "n8n-nodes-base.code" } | Select-Object -First 1
}
if (-not $validate) { throw "Missing Code node for validation" }

# Prefer the node directly connected from Validate as the IF gate
$gateIf = $null
$validateConn = $wf.connections.($validate.name)
if ($validateConn -and $validateConn.main -and $validateConn.main.Count -ge 1 -and $validateConn.main[0].Count -ge 1) {
  $nextName = $validateConn.main[0][0].node
  $candidate = $nodeByName[$nextName]
  if ($candidate -and $candidate.type -eq "n8n-nodes-base.if") { $gateIf = $candidate }
}
if (-not $gateIf) {
  $gateIf = $nodes | Where-Object { $_.type -eq "n8n-nodes-base.if" } | Select-Object -First 1
}
if (-not $gateIf) { throw "Missing IF node to gate validation" }

Write-Host ("Patching workflow {0} ({1})" -f $wfId, $wf.name) -ForegroundColor Cyan

# 1) Validation code (exact)
$validate.parameters.jsCode = $validationJs

# 2) IF gate condition (status == pass)
$gateIf.parameters.conditions = @{
  string = @(
    @{
      value1    = '={{ $json.status }}'
      operation = "equal"
      value2    = "pass"
    }
  )
}

# 3) Webhook must wait for response node
if (-not $webhook.parameters) { $webhook.parameters = @{} }
$webhook.parameters.responseMode = "responseNode"

# 4) Respond node must return $json and use http_code / error fallback
$respond.parameters.respondWith = "json"
$respond.parameters.responseBody = '={{ $json }}'
if (-not $respond.parameters.options) { $respond.parameters.options = @{} }
$respond.parameters.options.responseCode = '={{ $json.http_code || ($json.status === "error" ? 400 : 200) }}'

# 5) Enforce routing: Webhook -> Validate -> IF; IF false -> Respond
if (-not $wf.connections) { $wf.connections = @{} }

$wf.connections.($webhook.name) = @{
  main = @(@(@{ node = $validate.name; type = "main"; index = 0 }))
}

$wf.connections.($validate.name) = @{
  main = @(@(@{ node = $gateIf.name; type = "main"; index = 0 }))
}

if (-not $wf.connections.($gateIf.name)) {
  $wf.connections.($gateIf.name) = @{ main = @() }
}
if (-not $wf.connections.($gateIf.name).main) {
  $wf.connections.($gateIf.name).main = @()
}

# Preserve existing true branch if present; otherwise error
$trueBranch = $wf.connections.($gateIf.name).main[0]
if (-not $trueBranch -or $trueBranch.Count -lt 1) {
  throw "IF node '$($gateIf.name)' has no TRUE branch; wire its pass path first, then rerun."
}

$wf.connections.($gateIf.name).main = @(
  $trueBranch,
  @(@{ node = $respond.name; type = "main"; index = 0 })
)

if ($DryRun) {
  Write-Host "DryRun: not updating workflow via API." -ForegroundColor Yellow
  Write-Host "Would patch nodes:" -ForegroundColor Yellow
  Write-Host ("- Webhook:  {0} (id={1})" -f $webhook.name, $webhook.id)
  Write-Host ("- Validate: {0} (id={1})" -f $validate.name, $validate.id)
  Write-Host ("- IF Gate:  {0} (id={1})" -f $gateIf.name, $gateIf.id)
  Write-Host ("- Respond:  {0} (id={1})" -f $respond.name, $respond.id)
  $trueNext = $trueBranch | ForEach-Object { $_.node } | Where-Object { $_ } | Select-Object -First 5
  if ($trueNext -and $trueNext.Count -gt 0) {
    Write-Host ("Existing TRUE branch next nodes (first 5): " + ($trueNext -join ", "))
  }
  exit 0
}

$null = Update-Workflow -Id $wfId -Workflow $wf
Write-Host "Update complete. Now click Execute workflow / Listen for test event and rerun your missing_field test." -ForegroundColor Green

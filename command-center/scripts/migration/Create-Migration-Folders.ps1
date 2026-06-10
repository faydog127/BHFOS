param(
  # Root where the numbered folders should be created (example: C:\Users\you).
  [Parameter(Mandatory = $true)]
  [string] $RootPath,

  # Actually creates the folders. Without -Apply, prints a report only.
  [switch] $Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$folderNames = @(
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

$plan = @()
foreach ($name in $folderNames) {
  $p = Join-Path $RootPath $name
  $plan += [ordered]@{
    name = $name
    path = $p
    exists = (Test-Path -LiteralPath $p)
  }
}

if (-not $Apply) {
  [ordered]@{
    apply = $false
    note = "Report only. Re-run with -Apply to create missing folders."
    root_path = $RootPath
    folders = $plan
    recommended_apply = ("pwsh -File scripts/migration/Create-Migration-Folders.ps1 -RootPath `"{0}`" -Apply" -f $RootPath)
  } | ConvertTo-Json -Depth 4
  exit 0
}

foreach ($row in $plan) {
  if (-not $row.exists) {
    New-Item -ItemType Directory -Force -Path $row.path | Out-Null
  }
}

[ordered]@{
  apply = $true
  root_path = $RootPath
  folders = ($plan | ForEach-Object { $_.exists = $true; $_ })
} | ConvertTo-Json -Depth 4


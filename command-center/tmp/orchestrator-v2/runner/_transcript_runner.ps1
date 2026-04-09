param(
  [Parameter(Mandatory = $true)][string]$TranscriptPath,
  [Parameter(Mandatory = $true)][string]$StderrPath,
  [Parameter(Mandatory = $true)][string]$ScriptCommand
)

$ErrorActionPreference = "Stop"

$dir = Split-Path -Parent $TranscriptPath
if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$dir2 = Split-Path -Parent $StderrPath
if ($dir2 -and -not (Test-Path $dir2)) { New-Item -ItemType Directory -Force -Path $dir2 | Out-Null }

if (Test-Path $TranscriptPath) { Remove-Item -Force $TranscriptPath }
if (Test-Path $StderrPath) { Remove-Item -Force $StderrPath }
New-Item -ItemType File -Force -Path $StderrPath | Out-Null

Start-Transcript -Path $TranscriptPath -Force | Out-Null
try {
  Invoke-Expression $ScriptCommand
  exit 0
} catch {
  $_ | Out-String | Set-Content -Encoding UTF8 -Path $StderrPath
  exit 1
} finally {
  try { Stop-Transcript | Out-Null } catch { }
}

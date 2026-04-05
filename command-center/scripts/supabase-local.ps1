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

switch ($Command) {
  'start' {
    & $supabase @baseArgs start --exclude logflare
    break
  }
  'stop' {
    & $supabase @baseArgs stop --no-backup
    break
  }
  'restart' {
    & $supabase @baseArgs stop --no-backup
    & $supabase @baseArgs start --exclude logflare
    break
  }
  'status' {
    & $supabase @baseArgs status
    break
  }
  'reset' {
    & $supabase @baseArgs db reset --yes
    break
  }
}

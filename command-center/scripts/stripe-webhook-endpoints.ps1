param(
  # Supabase project ref (used only to print the expected webhook URL).
  [string]$ProjectRef = 'wwyxohjnyqnegzbxtuxs',

  # The Edge Function name you expect Stripe to call for webhooks.
  # NOTE: This function may not exist yet; this script will report that.
  [string]$WebhookFunctionName = 'stripe-webhook',

  # Optional: explicit Stripe secret key override (sk_test_... / sk_live_...).
  # If not provided, this script looks for STRIPE_SECRET_KEY in:
  #  1) current process env
  #  2) ../supabase/.env
  [string]$StripeSecretKey
)

$ErrorActionPreference = 'Stop'

function Read-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if (-not (Test-Path -LiteralPath $Path)) { return $null }

  foreach ($line in (Get-Content -LiteralPath $Path -ErrorAction Stop)) {
    if ($line -match '^\s*#') { continue }
    if (-not ($line -match '^\s*[^=]+\s*=')) { continue }
    $parts = $line.Split('=', 2)
    $key = $parts[0].Trim()
    if ($key -ne $Name) { continue }
    $val = $parts[1].Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"')) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    return $val
  }

  return $null
}

$workdir = Split-Path $PSScriptRoot -Parent
$dotenvPath = Join-Path $workdir 'supabase\.env'

if (-not $StripeSecretKey) { $StripeSecretKey = $env:STRIPE_SECRET_KEY }
if (-not $StripeSecretKey) { $StripeSecretKey = Read-DotEnvValue -Path $dotenvPath -Name 'STRIPE_SECRET_KEY' }

if (-not $StripeSecretKey) {
  throw "STRIPE_SECRET_KEY is missing. Set it in the environment or in $dotenvPath, then rerun."
}

$expectedUrl = "https://$ProjectRef.supabase.co/functions/v1/$WebhookFunctionName"

Write-Host "Expected webhook URL: $expectedUrl"
Write-Host ""

# Fetch webhook endpoints from Stripe.
# We use basic auth where the Stripe secret key is the username and the password is blank.
$raw = & curl.exe -s -u "${StripeSecretKey}:" "https://api.stripe.com/v1/webhook_endpoints?limit=100"
if (-not $raw) { throw "No response from Stripe API." }

$json = $raw | ConvertFrom-Json
if (-not $json -or -not $json.data) {
  # Stripe errors are also JSON and typically include { error: { ... } }.
  if ($json.error) {
    $msg = $json.error.message
    throw "Stripe API error: $msg"
  }
  throw "Unexpected Stripe API response (no data array)."
}

$all = @($json.data)
$supabaseEndpoints = @($all | Where-Object { $_.url -match 'supabase\.co' })
$expected = @($all | Where-Object { $_.url -eq $expectedUrl })

Write-Host ("Total Stripe webhook endpoints: {0}" -f $all.Count)
Write-Host ("Supabase webhook endpoints:     {0}" -f $supabaseEndpoints.Count)
Write-Host ("Expected URL matches:          {0}" -f $expected.Count)

if ($supabaseEndpoints.Count -gt 0) {
  Write-Host ""
  Write-Host "Supabase endpoints found:"
  foreach ($e in $supabaseEndpoints) {
    $enabledEvents = if ($e.enabled_events -is [string[]]) { ($e.enabled_events -join ',') } else { '' }
    $status = if ($null -ne $e.status) { $e.status } else { '(unknown)' }
    Write-Host ("- id={0} status={1} url={2}" -f $e.id, $status, $e.url)
    if ($enabledEvents) { Write-Host ("  events={0}" -f $enabledEvents) }
  }
}

if ($expected.Count -eq 0) {
  Write-Host ""
  Write-Host "NOT FOUND: No Stripe webhook endpoint matches the expected URL above."
  Write-Host "If you intend to use that URL, create a Stripe webhook endpoint for it (Test or Live mode as appropriate)."
}

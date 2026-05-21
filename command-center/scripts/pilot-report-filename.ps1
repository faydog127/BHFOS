param(
  [Parameter(Mandatory = $true)]
  [string] $Date,

  [Parameter(Mandatory = $true)]
  [string] $Address,

  [Parameter(Mandatory = $true)]
  # Examples: before-report, after-report, invoice, estimate, work-order
  [string] $Type
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-DateIso([string] $Value) {
  if ($Value -notmatch "^[0-9]{4}-[0-9]{2}-[0-9]{2}$") {
    throw "Date must be YYYY-MM-DD (got: $Value)"
  }
  return $Value
}

function Slugify([string] $Value) {
  $raw = ($Value ?? "").Trim().ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($raw)) { return "" }

  # Keep only letters/numbers; everything else becomes '-'
  $chars = $raw.ToCharArray() | ForEach-Object {
    $c = [int]$_
    $isAlphaNum = ($c -ge 48 -and $c -le 57) -or ($c -ge 97 -and $c -le 122)
    if ($isAlphaNum) { [char]$c } else { '-' }
  }

  $s = -join $chars
  $s = ($s -replace "-{2,}", "-").Trim("-")
  return $s
}

$d = Assert-DateIso -Value $Date
$addr = Slugify -Value $Address
if ([string]::IsNullOrWhiteSpace($addr)) { throw "Address slug is empty" }

$typeSlug = Slugify -Value $Type
if ([string]::IsNullOrWhiteSpace($typeSlug)) { throw "Type slug is empty" }

$filename = "{0}__{1}__{2}.pdf" -f $d, $addr, $typeSlug
Write-Output $filename

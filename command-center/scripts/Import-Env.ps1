param(
  [string[]] $Files = @(".env", ".env.local"),
  [switch] $Override
)

$loaded = @()

foreach ($file in $Files) {
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

    $alreadySet = Test-Path -LiteralPath ("Env:\" + $key)
    if ($Override -or -not $alreadySet) {
      Set-Item -Path ("Env:\" + $key) -Value $value
      $loaded += $key
    }
  }
}

if ($loaded.Count -gt 0) {
  Write-Host ("Loaded env vars: " + (($loaded | Sort-Object -Unique) -join ", "))
} else {
  Write-Host "No env vars loaded."
}


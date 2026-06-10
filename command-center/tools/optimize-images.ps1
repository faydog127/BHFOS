param(
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [int]$MaxDimension = 1600,
  [int]$Quality = 82
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Path)) {
  throw "Path not found: $Path"
}

Add-Type -AssemblyName System.Drawing

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
if (-not $encoder) { throw "JPEG encoder not available." }

$qualityValue = [int64][Math]::Max(10, [Math]::Min(95, $Quality))
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), $qualityValue

$files = Get-ChildItem -LiteralPath $Path -File -Include *.jpg, *.jpeg -ErrorAction Stop
foreach ($file in $files) {
  $src = $file.FullName
  $tmp = "$src.__opt.tmp"

  $img = $null
  $bmp = $null
  $g = $null
  try {
    $img = [System.Drawing.Image]::FromFile($src)
    $w = $img.Width
    $h = $img.Height
    $max = [Math]::Max($w, $h)
    $scale = if ($max -gt 0) { [Math]::Min(1.0, $MaxDimension / $max) } else { 1.0 }
    $nw = [int][Math]::Max(1, [Math]::Round($w * $scale))
    $nh = [int][Math]::Max(1, [Math]::Round($h * $scale))

    $bmp = New-Object System.Drawing.Bitmap $nw, $nh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $nw, $nh)

    $bmp.Save($tmp, $encoder, $ep)
  } catch {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    throw
  } finally {
    if ($g) { $g.Dispose() }
    if ($bmp) { $bmp.Dispose() }
    if ($img) { $img.Dispose() }
  }

  # Replace after all handles are disposed.
  if (Test-Path -LiteralPath $tmp) {
    Move-Item -LiteralPath $tmp -Destination $src -Force
  }
}

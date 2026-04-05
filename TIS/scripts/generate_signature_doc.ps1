param(
  [string]$OutputDir = "c:\BHFOS\TIS\generated\signature-pack",
  [string]$Name = "Erron Fayson",
  [string]$Title = "Founder / Owner",
  [string]$Company = "The Vent Guys",
  [string]$Phone = "(321) 360-9704",
  [string]$Website = "www.vent-guys.com",
  [string]$Email = "info@vent-guys.com",
  [string]$Tagline = "Clean Air. Clear Results."
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$logoPath = "c:\BHFOS\command-center\public\assets\branding\TVG_logo.png"
if (-not (Test-Path -LiteralPath $logoPath)) {
  throw "Logo not found at $logoPath"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$assetsDir = Join-Path $OutputDir "assets"
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

function Convert-HexToColor {
  param([string]$Hex)
  return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function New-RoundedRectPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-PillBadgeImage {
  param(
    [string]$Text,
    [string]$OutputPath,
    [string]$BackgroundHex = "#EAF4FF",
    [string]$BorderHex = "#B8D8FF",
    [string]$TextHex = "#1B263B"
  )

  $font = New-Object System.Drawing.Font("Arial", 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $probe = New-Object System.Drawing.Bitmap 8, 8
  $probeGraphics = [System.Drawing.Graphics]::FromImage($probe)
  $probeGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $textSize = $probeGraphics.MeasureString($Text, $font)
  $probeGraphics.Dispose()
  $probe.Dispose()

  $width = [Math]::Max(250, [int][Math]::Ceiling($textSize.Width) + 48)
  $height = 58

  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $background = New-Object System.Drawing.SolidBrush (Convert-HexToColor $BackgroundHex)
  $borderPen = New-Object System.Drawing.Pen (Convert-HexToColor $BorderHex), 2
  $textBrush = New-Object System.Drawing.SolidBrush (Convert-HexToColor $TextHex)
  $path = New-RoundedRectPath -X 1 -Y 1 -Width ($width - 3) -Height ($height - 3) -Radius 24

  $graphics.FillPath($background, $path)
  $graphics.DrawPath($borderPen, $path)

  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, 0, $width, $height)
  $graphics.DrawString($Text, $font, $textBrush, $rect, $format)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $format.Dispose()
  $path.Dispose()
  $textBrush.Dispose()
  $borderPen.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  $font.Dispose()
}

function New-CertBadgeImage {
  param(
    [string]$Text,
    [string]$OutputPath
  )

  $font = New-Object System.Drawing.Font("Arial", 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subFont = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $probe = New-Object System.Drawing.Bitmap 8, 8
  $probeGraphics = [System.Drawing.Graphics]::FromImage($probe)
  $textSize = $probeGraphics.MeasureString($Text, $font)
  $probeGraphics.Dispose()
  $probe.Dispose()

  $width = [Math]::Max(310, [int][Math]::Ceiling($textSize.Width) + 120)
  $height = 76

  $bitmap = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $navyBrush = New-Object System.Drawing.SolidBrush (Convert-HexToColor "#1B263B")
  $goldBrush = New-Object System.Drawing.SolidBrush (Convert-HexToColor "#F4C542")
  $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $goldPen = New-Object System.Drawing.Pen (Convert-HexToColor "#F4C542"), 2

  $path = New-RoundedRectPath -X 1 -Y 1 -Width ($width - 3) -Height ($height - 3) -Radius 20
  $graphics.FillPath($navyBrush, $path)
  $graphics.DrawPath($goldPen, $path)

  $iconRect = New-Object System.Drawing.Rectangle(12, 12, 52, 52)
  $graphics.FillEllipse($goldBrush, $iconRect)
  $checkPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White, 4)
  $checkPoints = New-Object "System.Drawing.Point[]" 3
  $checkPoints[0] = New-Object System.Drawing.Point(26, 39)
  $checkPoints[1] = New-Object System.Drawing.Point(35, 48)
  $checkPoints[2] = New-Object System.Drawing.Point(50, 28)
  $graphics.DrawLines($checkPen, $checkPoints)

  $graphics.DrawString($Text, $font, $whiteBrush, 78, 16)
  $graphics.DrawString("CERTIFIED", $subFont, $goldBrush, 79, 45)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $checkPen.Dispose()
  $path.Dispose()
  $goldPen.Dispose()
  $whiteBrush.Dispose()
  $goldBrush.Dispose()
  $navyBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
  $subFont.Dispose()
  $font.Dispose()
}

function Convert-ToFileUri {
  param([string]$Path)
  return ([System.Uri]::new($Path)).AbsoluteUri
}

$nadcaBadge = Join-Path $assetsDir "nadca-certified.png"
$airDuctBadge = Join-Path $assetsDir "air-duct-cleaning.png"
$dryerVentBadge = Join-Path $assetsDir "dryer-vent-service.png"

New-CertBadgeImage -Text "NADCA Certified" -OutputPath $nadcaBadge
New-PillBadgeImage -Text "Air Duct Cleaning" -OutputPath $airDuctBadge
New-PillBadgeImage -Text "Dryer Vent Service" -OutputPath $dryerVentBadge

$logoUri = Convert-ToFileUri $logoPath
$nadcaUri = Convert-ToFileUri $nadcaBadge
$airDuctUri = Convert-ToFileUri $airDuctBadge
$dryerVentUri = Convert-ToFileUri $dryerVentBadge

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$htmlPath = Join-Path $OutputDir "tvg-signature-styles-$stamp.html"
$docxPath = Join-Path $OutputDir "tvg-signature-styles-$stamp.docx"
$pdfPath = Join-Path $OutputDir "tvg-signature-styles-$stamp.pdf"

$html = @"
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>TVG Signature Styles</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1B263B; margin: 36px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 24px 0 10px; }
    p.meta { color: #667085; margin: 0 0 18px; }
    .card { border: 1px solid #d7e3f5; border-radius: 14px; padding: 20px; margin-bottom: 18px; }
    .sig-table { border-collapse: collapse; width: 100%; }
    .sig-table td { vertical-align: top; }
    .logo-cell { width: 170px; padding-right: 18px; }
    .divider-cell { border-left: 3px solid #4DA6FF; padding-left: 18px; }
    .name { font-size: 18px; font-weight: 700; }
    .title { font-size: 13px; color: #4B5563; }
    .company { font-size: 15px; font-weight: 700; margin-top: 2px; }
    .info { font-size: 13px; line-height: 1.45; margin-top: 10px; }
    .tagline { font-size: 13px; font-weight: 700; color: #4DA6FF; margin-top: 10px; }
    .badge-row img { vertical-align: middle; margin: 12px 8px 0 0; }
    .center { text-align: center; }
    .compact-rail { width: 132px; background: #f6f9ff; border-right: 2px solid #d7e3f5; padding: 12px; }
    .compact-body { padding-left: 16px; }
    .mini-note { font-size: 11px; color: #667085; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>The Vent Guys Signature Styles</h1>
  <p class="meta">Prepared on $(Get-Date -Format "MMMM d, yyyy") with embedded logo and sized badge assets.</p>

  <h2>Style 1: Classic Split</h2>
  <div class="card">
    <table class="sig-table">
      <tr>
        <td class="logo-cell">
          <img src="$logoUri" width="140" alt="The Vent Guys logo">
        </td>
        <td class="divider-cell">
          <div class="name">$Name</div>
          <div class="title">$Title</div>
          <div class="company">$Company</div>
          <div class="info">
            $Phone<br>
            $Website<br>
            $Email
          </div>
          <div class="tagline">$Tagline</div>
          <div class="badge-row">
            <img src="$nadcaUri" height="38" alt="NADCA Certified">
            <img src="$airDuctUri" height="34" alt="Air Duct Cleaning">
            <img src="$dryerVentUri" height="34" alt="Dryer Vent Service">
          </div>
        </td>
      </tr>
    </table>
  </div>

  <h2>Style 2: Centered Stack</h2>
  <div class="card center">
    <div>
      <img src="$logoUri" width="150" alt="The Vent Guys logo">
    </div>
    <div class="name" style="margin-top:12px;">$Name</div>
    <div class="title">$Title</div>
    <div class="company">$Company</div>
    <div class="info">
      $Phone<br>
      $Website<br>
      $Email
    </div>
    <div class="tagline">$Tagline</div>
    <div class="badge-row" style="margin-top:8px;">
      <img src="$nadcaUri" height="40" alt="NADCA Certified">
      <img src="$airDuctUri" height="34" alt="Air Duct Cleaning">
      <img src="$dryerVentUri" height="34" alt="Dryer Vent Service">
    </div>
  </div>

  <h2>Style 3: Compact Rail</h2>
  <div class="card">
    <table class="sig-table">
      <tr>
        <td class="compact-rail">
          <img src="$logoUri" width="106" alt="The Vent Guys logo">
          <div class="mini-note">Brevard County service</div>
        </td>
        <td class="compact-body">
          <div class="name">$Name</div>
          <div class="title">$Title</div>
          <div class="company">$Company</div>
          <div class="info">
            $Phone<br>
            $Website<br>
            $Email
          </div>
          <div class="tagline">$Tagline</div>
          <div class="badge-row">
            <img src="$nadcaUri" height="36" alt="NADCA Certified">
            <img src="$airDuctUri" height="30" alt="Air Duct Cleaning">
            <img src="$dryerVentUri" height="30" alt="Dryer Vent Service">
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
"@

Set-Content -LiteralPath $htmlPath -Value $html -Encoding UTF8

$word = $null
$document = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $document = $word.Documents.Open($htmlPath)

  $wdFormatDocumentDefault = 16
  $wdExportFormatPDF = 17

  $document.SaveAs2($docxPath, $wdFormatDocumentDefault)
  $document.ExportAsFixedFormat($pdfPath, $wdExportFormatPDF)
  $document.Close()
  $word.Quit()
}
finally {
  if ($document -ne $null) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
  }
  if ($word -ne $null) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

Write-Output "HTML: $htmlPath"
Write-Output "DOCX: $docxPath"
Write-Output "PDF: $pdfPath"

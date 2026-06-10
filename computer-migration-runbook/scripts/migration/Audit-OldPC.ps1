param(
    [Parameter(Mandatory=$true)]
    [string]$OutputDir,

    [switch]$ComputeSizes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Get-FolderSizeBytes {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    $total = 0
    try {
        Get-ChildItem -LiteralPath $Path -Force -Recurse -File -ErrorAction SilentlyContinue |
            ForEach-Object { $total += $_.Length }
        return $total
    }
    catch {
        return $null
    }
}

Ensure-Directory -Path $OutputDir

$userProfile = [Environment]::GetFolderPath("UserProfile")
$desktop = [Environment]::GetFolderPath("Desktop")
$documents = [Environment]::GetFolderPath("MyDocuments")
$pictures = [Environment]::GetFolderPath("MyPictures")
$music = [Environment]::GetFolderPath("MyMusic")
$videos = [Environment]::GetFolderPath("MyVideos")
$downloads = Join-Path $userProfile "Downloads"

$userFolders = @(
    @{ Name = "Desktop"; Path = $desktop },
    @{ Name = "Documents"; Path = $documents },
    @{ Name = "Downloads"; Path = $downloads },
    @{ Name = "Pictures"; Path = $pictures },
    @{ Name = "Videos"; Path = $videos },
    @{ Name = "Music"; Path = $music }
)

$userFolderReport = foreach ($folder in $userFolders) {
    $exists = Test-Path -LiteralPath $folder.Path
    $sizeBytes = $null
    if ($ComputeSizes -and $exists) {
        $sizeBytes = Get-FolderSizeBytes -Path $folder.Path
    }

    [pscustomobject]@{
        Name = $folder.Name
        Path = $folder.Path
        Exists = $exists
        SizeBytes = $sizeBytes
    }
}

$userFolderReport | Export-Csv -NoTypeInformation -Path (Join-Path $OutputDir "user-folders.csv")

$browserPaths = @(
    @{ Browser = "Chrome"; Path = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data" },
    @{ Browser = "Edge"; Path = Join-Path $env:LOCALAPPDATA "Microsoft\Edge\User Data" },
    @{ Browser = "Firefox"; Path = Join-Path $env:APPDATA "Mozilla\Firefox\Profiles" }
)

$browserReport = foreach ($browser in $browserPaths) {
    [pscustomobject]@{
        Browser = $browser.Browser
        Path = $browser.Path
        Exists = Test-Path -LiteralPath $browser.Path
    }
}

$browserReport | Export-Csv -NoTypeInformation -Path (Join-Path $OutputDir "browser-paths.csv")

$cloudCandidates = @(
    @{ Name = "OneDrive"; Path = $env:OneDrive },
    @{ Name = "Google Drive"; Path = Join-Path $userProfile "Google Drive" },
    @{ Name = "Google Drive Stream"; Path = "G:\My Drive" },
    @{ Name = "Dropbox"; Path = Join-Path $userProfile "Dropbox" },
    @{ Name = "iCloud Drive"; Path = Join-Path $userProfile "iCloudDrive" }
)

$cloudReport = foreach ($cloud in $cloudCandidates) {
    if ([string]::IsNullOrWhiteSpace($cloud.Path)) {
        $exists = $false
    } else {
        $exists = Test-Path -LiteralPath $cloud.Path
    }

    [pscustomobject]@{
        Name = $cloud.Name
        Path = $cloud.Path
        Exists = $exists
    }
}

$cloudReport | Export-Csv -NoTypeInformation -Path (Join-Path $OutputDir "cloud-folders.csv")

$uninstallRoots = @(
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

$apps = foreach ($root in $uninstallRoots) {
    Get-ItemProperty $root -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName } |
        Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, InstallLocation
}

$apps |
    Sort-Object DisplayName -Unique |
    Export-Csv -NoTypeInformation -Path (Join-Path $OutputDir "installed-apps.csv")

$environment = [pscustomobject]@{
    ComputerName = $env:COMPUTERNAME
    UserName = $env:USERNAME
    UserProfile = $userProfile
    PowerShellVersion = $PSVersionTable.PSVersion.ToString()
    AuditDateUtc = (Get-Date).ToUniversalTime().ToString("o")
    ComputeSizes = [bool]$ComputeSizes
}

$environment | ConvertTo-Json -Depth 5 | Out-File -Encoding UTF8 -FilePath (Join-Path $OutputDir "environment.json")

$summary = [pscustomobject]@{
    AuditComplete = $true
    OutputDir = $OutputDir
    UserFoldersFound = ($userFolderReport | Where-Object { $_.Exists }).Count
    BrowsersFound = ($browserReport | Where-Object { $_.Exists }).Count
    CloudFoldersFound = ($cloudReport | Where-Object { $_.Exists }).Count
    InstalledAppsCount = ($apps | Measure-Object).Count
    GeneratedFiles = @(
        "summary.json",
        "environment.json",
        "user-folders.csv",
        "browser-paths.csv",
        "cloud-folders.csv",
        "installed-apps.csv"
    )
}

$summary | ConvertTo-Json -Depth 5 | Out-File -Encoding UTF8 -FilePath (Join-Path $OutputDir "summary.json")

Write-Host "Migration audit complete."
Write-Host "Reports written to: $OutputDir"

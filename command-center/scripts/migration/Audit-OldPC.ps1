param(
  # Where to write the audit outputs (CSV/JSON). Defaults to repo tmp folder.
  [string] $OutputDir = "",

  # If set, computes directory sizes (can be slow on large folders).
  [switch] $ComputeSizes,

  # If set, also tries to list Microsoft Store apps for all users (can be slower; may require elevation).
  [switch] $IncludeAllUsersStoreApps
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir([string] $p) {
  if ([string]::IsNullOrWhiteSpace($p)) { throw "OutputDir is empty." }
  New-Item -ItemType Directory -Force -Path $p | Out-Null
}

function Safe-GetItem([string] $p) {
  try { return Get-Item -LiteralPath $p -ErrorAction Stop } catch { return $null }
}

function DirSizeBytes([string] $p) {
  if (-not (Test-Path -LiteralPath $p)) { return $null }
  try {
    $m = Get-ChildItem -LiteralPath $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum
    if ($null -eq $m -or $null -eq $m.Sum) { return 0 }
    return [int64] $m.Sum
  } catch {
    return $null
  }
}

function Export-CsvUtf8([object[]] $rows, [string] $path) {
  if ($null -eq $rows) { $rows = @() }
  $normalized = @()
  foreach ($r in @($rows)) {
    if ($null -eq $r) { continue }
    if ($r -is [System.Collections.IDictionary]) {
      $normalized += [pscustomobject] $r
      continue
    }
    $normalized += $r
  }

  if ($normalized.Count -eq 0) {
    "" | Out-File -Encoding utf8 -FilePath $path
    return
  }

  $normalized | Export-Csv -NoTypeInformation -Encoding utf8 -Path $path
}

function Export-JsonUtf8([object] $obj, [string] $path, [int] $depth = 6) {
  ($obj | ConvertTo-Json -Depth $depth) | Out-File -Encoding utf8 -FilePath $path
}

function Write-TextUtf8([string[]] $lines, [string] $path) {
  if ($null -eq $lines) { $lines = @() }
  ($lines -join "`r`n") | Out-File -Encoding utf8 -FilePath $path
}

function Get-UninstallEntries([string] $regPath) {
  try {
    Get-ItemProperty -Path $regPath -ErrorAction Stop |
      Where-Object { $_.DisplayName -and $_.DisplayName.Trim().Length -gt 0 } |
      ForEach-Object {
        [ordered]@{
          name = $_.DisplayName
          version = $_.DisplayVersion
          publisher = $_.Publisher
          install_date = $_.InstallDate
          install_location = $_.InstallLocation
          uninstall_string = $_.UninstallString
          registry_path = $regPath
        }
      }
  } catch {
    @()
  }
}

function Get-BrowserProfiles([string] $browserName, [string] $basePath) {
  if (-not (Test-Path -LiteralPath $basePath)) { return @() }
  $profiles = @()
  try {
    $dirs = Get-ChildItem -LiteralPath $basePath -Directory -ErrorAction SilentlyContinue
    foreach ($d in $dirs) {
      if ($d.Name -eq "Default" -or $d.Name -like "Profile *") {
        $profiles += [ordered]@{
          browser = $browserName
          profile = $d.Name
          path = $d.FullName
        }
      }
    }
  } catch { }
  return $profiles
}

function Get-FirefoxProfiles([string] $basePath) {
  if (-not (Test-Path -LiteralPath $basePath)) { return @() }
  $profiles = @()
  try {
    Get-ChildItem -LiteralPath $basePath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $profiles += [ordered]@{
        browser = "Firefox"
        profile = $_.Name
        path = $_.FullName
      }
    }
  } catch { }
  return $profiles
}

$timestamp = (Get-Date -Format "yyyyMMdd-HHmmss")
if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $repoTmp = Resolve-Path (Join-Path $PSScriptRoot "..\\..\\tmp") -ErrorAction SilentlyContinue
  if ($null -eq $repoTmp) {
    $OutputDir = Join-Path (Get-Location) ("migration-audit-" + $timestamp)
  } else {
    $OutputDir = Join-Path $repoTmp.Path ("migration-audit-" + $timestamp)
  }
}
Ensure-Dir $OutputDir

$paths = [ordered]@{
  user_profile = $env:USERPROFILE
  desktop = [Environment]::GetFolderPath("Desktop")
  documents = [Environment]::GetFolderPath("MyDocuments")
  downloads = (Join-Path $env:USERPROFILE "Downloads")
  pictures = [Environment]::GetFolderPath("MyPictures")
  videos = [Environment]::GetFolderPath("MyVideos")
  music = [Environment]::GetFolderPath("MyMusic")
  appdata_roaming = $env:APPDATA
  appdata_local = $env:LOCALAPPDATA
  appdata_locallow = (Join-Path $env:USERPROFILE "AppData\\LocalLow")
}

$drives = @()
try {
  $drives = Get-PSDrive -PSProvider FileSystem | ForEach-Object {
    [ordered]@{
      name = $_.Name
      root = $_.Root
      used_gb = if ($_.Used -ne $null) { [math]::Round(($_.Used / 1GB), 2) } else { $null }
      free_gb = if ($_.Free -ne $null) { [math]::Round(($_.Free / 1GB), 2) } else { $null }
    }
  }
} catch { }

$cloudCandidates = @(
  (Join-Path $env:USERPROFILE "OneDrive"),
  (Join-Path $env:USERPROFILE "Dropbox"),
  (Join-Path $env:USERPROFILE "Google Drive"),
  (Join-Path $env:USERPROFILE "iCloudDrive"),
  (Join-Path $env:USERPROFILE "iCloud Drive"),
  (Join-Path $env:USERPROFILE "Box")
)
$cloudFolders = @()
foreach ($p in $cloudCandidates) {
  $cloudFolders += [ordered]@{
    path = $p
    exists = (Test-Path -LiteralPath $p)
  }
}

try {
  Get-ChildItem -LiteralPath $env:USERPROFILE -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "OneDrive*" -or $_.Name -like "Google Drive*" } |
    ForEach-Object {
      $cloudFolders += [ordered]@{ path = $_.FullName; exists = $true }
    }
} catch { }

$cloudFolders = @($cloudFolders | Sort-Object path -Unique)

$browserProfiles = @()
$browserProfiles += Get-BrowserProfiles "Chrome" (Join-Path $env:LOCALAPPDATA "Google\\Chrome\\User Data")
$browserProfiles += Get-BrowserProfiles "Edge" (Join-Path $env:LOCALAPPDATA "Microsoft\\Edge\\User Data")
$browserProfiles += Get-BrowserProfiles "Brave" (Join-Path $env:LOCALAPPDATA "BraveSoftware\\Brave-Browser\\User Data")
$browserProfiles += Get-FirefoxProfiles (Join-Path $env:APPDATA "Mozilla\\Firefox\\Profiles")

$keyFolderChecks = @()
foreach ($k in $paths.Keys) {
  $p = [string] $paths[$k]
  $item = Safe-GetItem $p
  $row = [ordered]@{
    key = $k
    path = $p
    exists = ($null -ne $item)
    last_write_time = if ($null -ne $item) { $item.LastWriteTime } else { $null }
    size_bytes = $null
  }
  if ($ComputeSizes -and $row.exists) {
    $row.size_bytes = DirSizeBytes $p
  }
  $keyFolderChecks += $row
}

$migrationFolderNames = @(
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
$migrationFolders = @()
foreach ($name in $migrationFolderNames) {
  $candidate = Join-Path $env:USERPROFILE $name
  $migrationFolders += [ordered]@{
    name = $name
    candidate_path = $candidate
    exists = (Test-Path -LiteralPath $candidate)
  }
}

$uninstallPaths = @(
  "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
  "HKCU:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*"
)

$installedApps = @()
foreach ($rp in $uninstallPaths) { $installedApps += Get-UninstallEntries $rp }
$installedApps = $installedApps |
  Sort-Object name, version, publisher -Unique

$storeAppsCurrentUser = @()
try {
  $storeAppsCurrentUser = Get-AppxPackage -ErrorAction Stop | ForEach-Object {
    [ordered]@{
      name = $_.Name
      package_family_name = $_.PackageFamilyName
      version = $_.Version.ToString()
      publisher = $_.Publisher
      install_location = $_.InstallLocation
      signature_kind = $_.SignatureKind
    }
  }
} catch { $storeAppsCurrentUser = @() }

$storeAppsAllUsers = @()
if ($IncludeAllUsersStoreApps) {
  try {
    $storeAppsAllUsers = Get-AppxPackage -AllUsers -ErrorAction Stop | ForEach-Object {
      [ordered]@{
        name = $_.Name
        package_family_name = $_.PackageFamilyName
        version = $_.Version.ToString()
        publisher = $_.Publisher
        install_location = $_.InstallLocation
        signature_kind = $_.SignatureKind
      }
    }
  } catch { $storeAppsAllUsers = @() }
}

$winget = [ordered]@{ available = $false; version = $null; export_file = $null; error = $null }
try {
  $wingetVersion = & winget --version 2>$null
  if ($LASTEXITCODE -eq 0 -and $wingetVersion) {
    $winget.available = $true
    $winget.version = ($wingetVersion | Select-Object -First 1)
  }
} catch { }

if ($winget.available) {
  $exportPath = Join-Path $OutputDir "winget-export.json"
  try {
    & winget export --output $exportPath --include-versions --accept-source-agreements --disable-interactivity 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0 -and (Test-Path -LiteralPath $exportPath)) {
      $winget.export_file = $exportPath
    } else {
      $listOut = & winget list --disable-interactivity 2>&1
      Write-TextUtf8 @($listOut) (Join-Path $OutputDir "winget-list.txt")
    }
  } catch {
    $winget.error = $_.Exception.Message
    try {
      $listOut = & winget list --disable-interactivity 2>&1
      Write-TextUtf8 @($listOut) (Join-Path $OutputDir "winget-list.txt")
    } catch { }
  }
}

$system = [ordered]@{}
try {
  $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
  $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
  $bios = Get-CimInstance Win32_BIOS -ErrorAction Stop
  $system = [ordered]@{
    computer_name = $env:COMPUTERNAME
    user_name = $env:USERNAME
    os_caption = $os.Caption
    os_version = $os.Version
    os_build = $os.BuildNumber
    install_date = $os.InstallDate
    last_boot = $os.LastBootUpTime
    manufacturer = $cs.Manufacturer
    model = $cs.Model
    bios_version = ($bios.SMBIOSBIOSVersion)
  }
} catch {
  $system = [ordered]@{
    computer_name = $env:COMPUTERNAME
    user_name = $env:USERNAME
  }
}

$out = [ordered]@{
  generated_at = (Get-Date).ToString("o")
  output_dir = $OutputDir
  compute_sizes = [bool] $ComputeSizes
  system = $system
  paths = $paths
  counts = [ordered]@{
    drives = ($drives | Measure-Object).Count
    installed_apps = ($installedApps | Measure-Object).Count
    store_apps_current_user = ($storeAppsCurrentUser | Measure-Object).Count
    store_apps_all_users = ($storeAppsAllUsers | Measure-Object).Count
    browser_profiles = ($browserProfiles | Measure-Object).Count
    winget_available = [int] ([bool] $winget.available)
  }
}

Export-JsonUtf8 $out (Join-Path $OutputDir "summary.json") 8
Export-CsvUtf8 $drives (Join-Path $OutputDir "drives.csv")
Export-CsvUtf8 $installedApps (Join-Path $OutputDir "installed-apps.csv")
Export-CsvUtf8 $storeAppsCurrentUser (Join-Path $OutputDir "store-apps-current-user.csv")
if ($IncludeAllUsersStoreApps) {
  Export-CsvUtf8 $storeAppsAllUsers (Join-Path $OutputDir "store-apps-all-users.csv")
}
Export-CsvUtf8 $browserProfiles (Join-Path $OutputDir "browser-profiles.csv")
Export-CsvUtf8 $cloudFolders (Join-Path $OutputDir "cloud-folders.csv")
Export-CsvUtf8 $keyFolderChecks (Join-Path $OutputDir "key-folder-checks.csv")
Export-CsvUtf8 $migrationFolders (Join-Path $OutputDir "migration-folders.csv")

$out | ConvertTo-Json -Depth 8

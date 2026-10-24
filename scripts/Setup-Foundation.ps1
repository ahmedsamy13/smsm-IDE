param([string]$CacheDirectory)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$lock = Get-Content -LiteralPath (Join-Path $projectRoot 'foundation.lock.json') -Raw | ConvertFrom-Json
if ($lock.platform -ne 'win32-x64' -or [Environment]::Is64BitOperatingSystem -ne $true) {
    throw 'This foundation requires 64-bit Windows.'
}
if ($lock.url -notlike 'https://github.com/VSCodium/vscodium/releases/download/*') {
    throw 'Unexpected runtime source in foundation.lock.json.'
}
$runtimeRoot = Join-Path $projectRoot ".runtime\vscodium-$($lock.version)"
$markerPath = Join-Path $runtimeRoot '.foundation-ready.json'
if (Test-Path -LiteralPath $markerPath) {
    $marker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
    if ($marker.sha256 -ne $lock.sha256 -or !(Test-Path -LiteralPath (Join-Path $runtimeRoot 'VSCodium.exe'))) {
        throw 'Existing runtime marker does not match the pinned runtime.'
    }
    Write-Output "Foundation already prepared: $runtimeRoot"
    exit 0
}
$driveRoot = [IO.Path]::GetPathRoot($projectRoot)
$drive = New-Object IO.DriveInfo($driveRoot)
$downloadRoot = if ($CacheDirectory) { [IO.Path]::GetFullPath($CacheDirectory) } else { Join-Path $projectRoot '.downloads' }
$cacheDrive = New-Object IO.DriveInfo([IO.Path]::GetPathRoot($downloadRoot))
if ($cacheDrive.AvailableFreeSpace -lt ($lock.bytes + 512MB)) { throw 'Insufficient download-cache space. No files were removed.' }
New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
$archivePath = Join-Path $downloadRoot $lock.asset
if (!(Test-Path -LiteralPath $archivePath)) {
    $partialPath = "$archivePath.partial"
    Write-Output "Downloading pinned $($lock.distribution) $($lock.version)..."
    Invoke-WebRequest -UseBasicParsing -Uri $lock.url -OutFile $partialPath
    if ((Get-Item -LiteralPath $partialPath).Length -ne $lock.bytes) { throw 'Downloaded archive size mismatch.' }
    if ((Get-FileHash -LiteralPath $partialPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $lock.sha256) {
        throw 'Downloaded archive checksum mismatch. Nothing will be executed.'
    }
    Move-Item -LiteralPath $partialPath -Destination $archivePath
}
if ((Get-Item -LiteralPath $archivePath).Length -ne $lock.bytes -or
    (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $lock.sha256) {
    throw 'Cached archive does not match the pinned release. Nothing will be extracted.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
    $expandedBytes = ($archive.Entries | Measure-Object -Property Length -Sum).Sum
    $resolvedRuntime = [IO.Path]::GetFullPath($runtimeRoot) + [IO.Path]::DirectorySeparatorChar
    foreach ($entry in $archive.Entries) {
        $entryTarget = [IO.Path]::GetFullPath((Join-Path $runtimeRoot $entry.FullName))
        if (!$entryTarget.StartsWith($resolvedRuntime, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Archive contains an entry outside the runtime directory.'
        }
    }
} finally { $archive.Dispose() }
if ($drive.AvailableFreeSpace -lt ($expandedBytes + 512MB)) { throw 'Insufficient room to extract the verified archive safely.' }
Write-Output ('Checksum verified. Extracting {0:N0} MB...' -f ($expandedBytes / 1MB))
New-Item -ItemType Directory -Path (Split-Path -Parent $runtimeRoot) -Force | Out-Null
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
Expand-Archive -LiteralPath $archivePath -DestinationPath $runtimeRoot -Force
foreach ($required in @('VSCodium.exe', 'resources\app\product.json', 'resources\app\out\cli.js')) {
    if (!(Test-Path -LiteralPath (Join-Path $runtimeRoot $required))) { throw "Runtime is missing $required" }
}
@{version=$lock.version;sha256=$lock.sha256;source=$lock.url} | ConvertTo-Json | Set-Content -LiteralPath $markerPath -Encoding UTF8
Write-Output "Foundation ready: $runtimeRoot"
Write-Output 'Double-click Start Personal IDE.cmd to open the example workspace.'

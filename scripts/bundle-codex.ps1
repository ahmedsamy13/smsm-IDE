$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$source=Join-Path $env:APPDATA 'npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc'
$destination=Join-Path $project '.runtime\codex-0.160.1'
$metadata=Get-Content -Raw -LiteralPath (Join-Path (Split-Path (Split-Path $source)) 'package.json')|ConvertFrom-Json
if($metadata.version -ne '0.160.1-win32-x64'){throw 'Expected the verified official Codex 0.160.1 Windows package'}
[IO.Directory]::CreateDirectory($destination)|Out-Null
& robocopy $source $destination /E /XJ /R:0 /W:0 /NFL /NDL /NJH /NJS|Out-Null
if($LASTEXITCODE -ge 8){throw 'Could not bundle the official runtime'}
$licenseUrl='https://raw.githubusercontent.com/openai/codex/rust-v0.160.1/LICENSE'
$license=(Invoke-WebRequest -Uri $licenseUrl).Content
[IO.File]::WriteAllText((Join-Path $destination 'LICENSE'),[string]$license)
$files=@(Get-ChildItem -LiteralPath $destination -Recurse -File|ForEach-Object {[ordered]@{path=[IO.Path]::GetRelativePath($destination,$_.FullName).Replace('\','/');sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}})
[IO.File]::WriteAllText((Join-Path $destination 'personal-ide-engine.json'),([ordered]@{version='0.160.1';source='@openai/codex@0.160.1-win32-x64';license='Apache-2.0';licenseUrl=$licenseUrl;files=$files}|ConvertTo-Json -Depth 6))
Write-Output 'Official Codex engine bundled with helpers and license notices.'
exit 0

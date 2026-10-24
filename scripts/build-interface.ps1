$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$interfaceRoot=Join-Path $projectRoot 'interface'
$stage=Join-Path ([IO.Path]::GetTempPath()) ('personal-ide-build-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($stage)|Out-Null
$previousOutput=$env:PERSONAL_IDE_BUILD_OUTPUT
try {
 $env:PERSONAL_IDE_BUILD_OUTPUT=$stage
 Push-Location $interfaceRoot
 try { node build.mjs; if($LASTEXITCODE -ne 0){throw 'Interface compilation failed'} } finally { Pop-Location }
 foreach($relative in @('dist\panel.js','dist\panel.css','dist\codex.js','dist\console.js','console.cjs','toolbox.cjs','workflow.cjs','import-utils.cjs','codex.cjs')) {
  $source=Join-Path $stage $relative
  $destination=Join-Path (Join-Path $interfaceRoot 'extension') $relative
  [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination))|Out-Null
  [IO.File]::WriteAllBytes($destination,[IO.File]::ReadAllBytes($source))
 }
 Write-Output 'Interface artifacts built and copied successfully.'
} finally { $env:PERSONAL_IDE_BUILD_OUTPUT=$previousOutput }

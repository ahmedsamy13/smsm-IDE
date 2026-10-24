param([string]$Compiler='D:\personal-ide-build-cache\installer-tools\Inno Setup 7\ISCC.exe')
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
$stage=Join-Path 'D:\personal-ide-build-cache' ('release-payload-'+[Guid]::NewGuid().ToString('N'))
$output=Join-Path $project 'release'
[IO.Directory]::CreateDirectory($stage)|Out-Null
[IO.Directory]::CreateDirectory($output)|Out-Null
function CopyTree([string]$source,[string]$destination,[string[]]$exclude=@()){
 $copyArguments=@($source,$destination,'/E','/XJ','/R:0','/W:0','/NFL','/NDL','/NJH','/NJS')
 if($exclude.Count){ $copyArguments+='/XD'; $copyArguments+=$exclude}
 & robocopy @copyArguments|Out-Null
 if($LASTEXITCODE -ge 8){throw ('Copy failed: '+$source)}
}
CopyTree (Join-Path $project '.runtime') (Join-Path $stage '.runtime') @('node-compile-cache')
CopyTree (Join-Path $project 'interface\extension') (Join-Path $stage 'interface\extension')
CopyTree (Join-Path $project 'examples\foundation-sandbox') (Join-Path $stage 'examples\foundation-sandbox') @('node_modules','.git','.data')
CopyTree (Join-Path $project 'examples\fullstack-demo') (Join-Path $stage 'examples\fullstack-demo') @('node_modules','.git','.data')
[IO.Directory]::CreateDirectory((Join-Path $stage 'scripts'))|Out-Null
foreach($name in @('foundation.mjs','start-ide.mjs','install-interface.mjs','install-core.mjs','package-interface.ps1')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination (Join-Path $stage ('scripts\'+$name))}
foreach($name in @('foundation.lock.json','workflow.lock.json','toolbox.lock.json','TOOLBOX.md','RELEASE-STATUS.md','Start Personal IDE.cmd','Launch Personal IDE.vbs','README.md','CODEX.md','CODEX-UI.md','CODEX-STATUS.md','WORKFLOW.md','THIRD_PARTY_NOTICES.txt')){Copy-Item -LiteralPath (Join-Path $project $name) -Destination (Join-Path $stage $name)}
$bundle=Join-Path $stage 'resources\extensions'
[IO.Directory]::CreateDirectory($bundle)|Out-Null
$workflow=Get-Content -LiteralPath (Join-Path $project 'workflow.lock.json') -Raw|ConvertFrom-Json
$toolbox=Get-Content -LiteralPath (Join-Path $project 'toolbox.lock.json') -Raw|ConvertFrom-Json
foreach($item in @($workflow.extensions)+@($toolbox.extensions)){
 $filename=$item.id+'-'+$item.version+'.vsix'
 $source=Join-Path $env:LOCALAPPDATA ('PersonalIDE\extension-cache\'+$filename)
 if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256){throw ('Extension checksum mismatch: '+$filename)}
 [IO.File]::WriteAllBytes((Join-Path $bundle $filename),[IO.File]::ReadAllBytes($source))
}
& (Join-Path $PSScriptRoot 'package-interface.ps1') -Source (Join-Path $stage 'interface\extension') -Output (Join-Path $bundle 'personal-ide-interface.vsix')
& $Compiler '/Q' ('/DStage='+$stage) ('/DOutput='+$output) (Join-Path $project 'packaging\personal-ide.iss')
if($LASTEXITCODE -ne 0){throw 'Installer compilation failed'}
$file=Join-Path $output 'PersonalIDE-0.6.1-x64-setup.exe'
$hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(($file+'.sha256'),($hash+'  '+[IO.Path]::GetFileName($file)+[Environment]::NewLine),[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $output 'build.json'),([ordered]@{version='0.6.1';stage=$stage;installer=$file;sha256=$hash;bytes=(Get-Item -LiteralPath $file).Length;compiler=(Get-Item -LiteralPath $Compiler).VersionInfo.FileVersion;builtAt=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
Write-Output ('Installer ready: '+$file)
exit 0

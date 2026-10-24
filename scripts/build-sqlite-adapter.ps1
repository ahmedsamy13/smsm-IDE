$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$project=Split-Path -Parent $PSScriptRoot
$cache=Join-Path $env:LOCALAPPDATA 'PersonalIDE\extension-cache'
$original=Join-Path $cache 'alexcvzz.vscode-sqlite-0.14.1.vsix'
$expected='4d6371a4701fbb34e4001f9a6262361e4f13998b2ea1460ef99a3148f59ddcd5'
if((Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'SQLite upstream checksum mismatch'}
$stage=Join-Path 'D:\personal-ide-build-cache' ('sqlite-adapter-'+[Guid]::NewGuid().ToString('N'))
[IO.Compression.ZipFile]::ExtractToDirectory($original,$stage)
$source=Join-Path $stage 'extension'
$main=Join-Path $source 'dist\extension.js'
$text=[IO.File]::ReadAllText($main)
$text=$text.Replace('type=\"table\"',"type='table'").Replace('type=\"view\"',"type='view'")
[IO.File]::WriteAllText($main,$text,[Text.UTF8Encoding]::new($false))
$manifest=Join-Path $source 'package.json'
$m=Get-Content -LiteralPath $manifest -Raw|ConvertFrom-Json -AsHashtable
$m.publisher='personal-ide'
$m.name='sqlite-browser'
$m.displayName='Personal IDE SQLite Browser'
$m.version='0.14.2'
$m.description='SQLite browsing based on alexcvzz.vscode-sqlite, with modern SQLite SQL-literal compatibility.'
$m.Remove('__metadata')
[IO.File]::WriteAllText($manifest,($m|ConvertTo-Json -Depth 50),[Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText((Join-Path $source 'NOTICE.personal-ide.txt'),'Based on AlexCovizzi/vscode-sqlite 0.14.1 (Apache-2.0). Modified for Personal IDE on 2026-10-23: sqlite_master type string literals now use SQL single quotes so maintained SQLite releases can browse schemas with double-quoted string literals disabled. Original license and source notices are retained. Only the two schema-query literals and package identity were changed.',[Text.UTF8Encoding]::new($false))
$output=Join-Path $cache 'personal-ide.sqlite-browser-0.14.2.vsix'
& (Join-Path $PSScriptRoot 'package-interface.ps1') -Source $source -Output $output
$hash=(Get-FileHash -LiteralPath $output -Algorithm SHA256).Hash.ToLowerInvariant()
$lockPath=Join-Path $project 'toolbox.lock.json'
$lock=Get-Content -LiteralPath $lockPath -Raw|ConvertFrom-Json
$replacement=[pscustomobject]@{id='personal-ide.sqlite-browser';version='0.14.2';sha256=$hash;license='Apache-2.0';localBuild='scripts/build-sqlite-adapter.ps1';upstream='alexcvzz.vscode-sqlite@0.14.1';upstreamSha256=$expected}
$lock.extensions=@($lock.extensions|ForEach-Object{if($_.id -in @('alexcvzz.vscode-sqlite','personal-ide.sqlite-browser')){$replacement}else{$_}})
[IO.File]::WriteAllText($lockPath,($lock|ConvertTo-Json -Depth 10),[Text.UTF8Encoding]::new($false))
Write-Output ('Built SQLite compatibility adapter: '+$hash)

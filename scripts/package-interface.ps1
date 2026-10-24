param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$Source=[IO.Path]::GetFullPath($Source)
$manifest=Get-Content -LiteralPath (Join-Path $Source 'package.json') -Raw | ConvertFrom-Json
function XmlEscape([string]$value){[Security.SecurityElement]::Escape($value)}
$name=XmlEscape $manifest.name
$publisher=XmlEscape $manifest.publisher
$version=XmlEscape $manifest.version
$displayName=XmlEscape $manifest.displayName
$engine=XmlEscape $manifest.engines.vscode
$vsix='<?xml version="1.0" encoding="utf-8"?><PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"><Metadata><Identity Language="en-US" Id="'+$name+'" Version="'+$version+'" Publisher="'+$publisher+'"/><DisplayName>'+$displayName+'</DisplayName><Description xml:space="preserve">Personal IDE interface and agent chat.</Description><Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="'+$engine+'"/><Property Id="Microsoft.VisualStudio.Code.ExecutesCode" Value="true"/></Properties></Metadata><Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation><Dependencies/><Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets></PackageManifest>'
$contentTypes='<?xml version="1.0" encoding="utf-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="json" ContentType="application/json"/><Default Extension="js" ContentType="application/javascript"/><Default Extension="cjs" ContentType="application/javascript"/><Default Extension="css" ContentType="text/css"/><Default Extension="vsixmanifest" ContentType="text/xml"/></Types>'
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($Output))|Out-Null
$stream=[IO.File]::Open($Output,[IO.FileMode]::Create,[IO.FileAccess]::ReadWrite)
$archive=[IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create)
try{
 foreach($pair in @(@('extension.vsixmanifest',$vsix),@('[Content_Types].xml',$contentTypes))){
  $entry=$archive.CreateEntry($pair[0])
  $writer=[IO.StreamWriter]::new($entry.Open(),[Text.UTF8Encoding]::new($false))
  try{$writer.Write($pair[1])}finally{$writer.Dispose()}
 }
 foreach($file in Get-ChildItem -LiteralPath $Source -Recurse -File){
  $relative=$file.FullName.Substring($Source.Length).TrimStart([char[]]@('\','/')).Replace('\','/')
  [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$file.FullName,('extension/'+$relative),[IO.Compression.CompressionLevel]::Optimal)|Out-Null
 }
}finally{$archive.Dispose();$stream.Dispose()}

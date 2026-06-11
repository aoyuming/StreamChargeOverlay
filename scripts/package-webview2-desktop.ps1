$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root "dist\webview2"
$singleWork = Join-Path $root "dist\webview2-single"
# Windows PowerShell 5 may read UTF-8 scripts without BOM as ANSI, so build the
# Chinese executable name from code points to keep packaging stable.
$appName = "DNF$([char]0x8D5E)$([char]0x52A9)$([char]0x7CFB)$([char]0x7EDF)-WebView2"
$exeName = "$appName.exe"
$appFolderPath = Join-Path $output $appName
$exePath = Join-Path $appFolderPath $exeName
$singleExePath = Join-Path $root "dist\DNF$([char]0x8D5E)$([char]0x52A9)$([char]0x7CFB)$([char]0x7EDF)-WebView2.exe"
$singleZipPath = Join-Path $singleWork "streamcharge-webview2.zip"
$singleLauncherSourcePath = Join-Path $root "desktop-webview2\SingleExeLauncher.cs"
$singleLauncherExePath = Join-Path $singleWork "streamcharge-webview2-launcher.exe"
$shellSourcePath = Join-Path $root "desktop-webview2\StreamChargeWebView2Shell.cs"

Set-Location $root

if (Test-Path $output) {
  Remove-Item -LiteralPath $output -Recurse -Force
}

if (Test-Path $singleWork) {
  Remove-Item -LiteralPath $singleWork -Recurse -Force
}

if (Test-Path -LiteralPath $singleExePath) {
  Remove-Item -LiteralPath $singleExePath -Force
}

New-Item -ItemType Directory -Path $appFolderPath | Out-Null
New-Item -ItemType Directory -Path $singleWork | Out-Null

$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $csc)) {
  $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path -LiteralPath $csc)) {
  throw "Missing .NET C# compiler: csc.exe"
}

$webView2PackageRoot = Join-Path $env:USERPROFILE ".nuget\packages\microsoft.web.webview2"
if (-not (Test-Path -LiteralPath $webView2PackageRoot)) {
  throw "Missing Microsoft.Web.WebView2 SDK in NuGet cache: $webView2PackageRoot"
}

$webView2Package = Get-ChildItem -LiteralPath $webView2PackageRoot -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1

if ($null -eq $webView2Package) {
  throw "Missing Microsoft.Web.WebView2 SDK package."
}

$webView2CoreDll = Join-Path $webView2Package.FullName "lib\net462\Microsoft.Web.WebView2.Core.dll"
$webView2WinFormsDll = Join-Path $webView2Package.FullName "lib\net462\Microsoft.Web.WebView2.WinForms.dll"
$webView2LoaderDll = Join-Path $webView2Package.FullName "runtimes\win-x64\native\WebView2Loader.dll"

foreach ($requiredPath in @($webView2CoreDll, $webView2WinFormsDll, $webView2LoaderDll)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Missing WebView2 packaging file: $requiredPath"
  }
}

& $csc `
  /nologo `
  /target:winexe `
  /platform:x64 `
  /optimize+ `
  /codepage:65001 `
  /utf8output `
  "/out:$exePath" `
  "/reference:System.dll" `
  "/reference:System.Core.dll" `
  "/reference:System.Drawing.dll" `
  "/reference:System.Windows.Forms.dll" `
  "/reference:$webView2CoreDll" `
  "/reference:$webView2WinFormsDll" `
  $shellSourcePath

if (-not (Test-Path -LiteralPath $exePath)) {
  throw "WebView2 desktop shell build failed, missing: $exePath"
}

Copy-Item -LiteralPath $webView2CoreDll -Destination $appFolderPath -Force
Copy-Item -LiteralPath $webView2WinFormsDll -Destination $appFolderPath -Force
Copy-Item -LiteralPath $webView2LoaderDll -Destination $appFolderPath -Force

Compress-Archive -LiteralPath $appFolderPath -DestinationPath $singleZipPath -CompressionLevel Optimal

& $csc `
  /nologo `
  /target:winexe `
  /platform:anycpu `
  /optimize+ `
  /codepage:65001 `
  /utf8output `
  "/out:$singleLauncherExePath" `
  "/reference:System.IO.Compression.dll" `
  "/reference:System.IO.Compression.FileSystem.dll" `
  "/reference:System.Windows.Forms.dll" `
  $singleLauncherSourcePath

if (-not (Test-Path -LiteralPath $singleLauncherExePath)) {
  throw "WebView2 single executable launcher build failed, missing: $singleLauncherExePath"
}

Copy-Item -LiteralPath $singleLauncherExePath -Destination $singleExePath -Force
$zipBytes = [System.IO.File]::ReadAllBytes($singleZipPath)
$lengthBytes = [System.BitConverter]::GetBytes([Int64]$zipBytes.Length)
$magicBytes = [System.Text.Encoding]::ASCII.GetBytes("SCZIP1__")
$outputStream = [System.IO.File]::Open($singleExePath, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write)
try {
  $outputStream.Write($zipBytes, 0, $zipBytes.Length)
  $outputStream.Write($lengthBytes, 0, $lengthBytes.Length)
  $outputStream.Write($magicBytes, 0, $magicBytes.Length)
} finally {
  $outputStream.Dispose()
}

if (-not (Test-Path -LiteralPath $singleExePath)) {
  throw "WebView2 single executable package failed, missing: $singleExePath"
}

Write-Host "WebView2 desktop package created: $exePath"
Write-Host "WebView2 single executable created: $singleExePath"

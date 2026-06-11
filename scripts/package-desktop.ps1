$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root "dist\desktop"
$singleWork = Join-Path $root "dist\desktop-single"
# Windows PowerShell 5 may read UTF-8 scripts without BOM as ANSI, so build the
# Chinese executable name from code points to keep packaging stable.
$appName = "DNF$([char]0x8D5E)$([char]0x52A9)$([char]0x7CFB)$([char]0x7EDF)"
$exeName = "$appName.exe"
$portableFolderName = "$appName-win32-x64"
$portableFolderPath = Join-Path $output $portableFolderName
$exePath = Join-Path $portableFolderPath $exeName
$singleExePath = Join-Path $root "dist\$appName.exe"
$singleZipPath = Join-Path $singleWork "streamcharge-desktop.zip"
$singleLauncherSourcePath = Join-Path $root "desktop\SingleExeLauncher.cs"
$singleLauncherExePath = Join-Path $singleWork "streamcharge-launcher.exe"

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

npx electron-packager . $appName `
  --platform=win32 `
  --arch=x64 `
  --out="$output" `
  --overwrite `
  --ignore="^/node_modules($|/)" `
  --ignore="^/data($|/)" `
  --ignore="^/dist($|/)" `
  --ignore="^/tmp($|/)" `
  --ignore="^/node_modules/\.vite($|/)" `
  --ignore="^/src($|/)" `
  --ignore="^/docs($|/)" `
  --ignore="^/scripts/create-server-package\.ps1$"

if (-not (Test-Path -LiteralPath $exePath)) {
  throw "Desktop package failed, missing: $exePath"
}

$desktopLocalesToKeep = @("zh-CN", "en-US")
$desktopLocalesPath = Join-Path $portableFolderPath "locales"
if (Test-Path -LiteralPath $desktopLocalesPath) {
  Get-ChildItem -LiteralPath $desktopLocalesPath -Filter "*.pak" | Where-Object {
    $desktopLocalesToKeep -notcontains $_.BaseName
  } | Remove-Item -Force
}

New-Item -ItemType Directory -Path $singleWork | Out-Null

Compress-Archive -LiteralPath $portableFolderPath -DestinationPath $singleZipPath -CompressionLevel Optimal

$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $csc)) {
  $csc = Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path -LiteralPath $csc)) {
  throw "Missing .NET C# compiler: csc.exe"
}

& $csc `
  /nologo `
  /target:winexe `
  /platform:anycpu `
  /optimize+ `
  "/out:$singleLauncherExePath" `
  "/reference:System.IO.Compression.dll" `
  "/reference:System.IO.Compression.FileSystem.dll" `
  "/reference:System.Windows.Forms.dll" `
  $singleLauncherSourcePath

if (-not (Test-Path -LiteralPath $singleLauncherExePath)) {
  throw "Single executable launcher build failed, missing: $singleLauncherExePath"
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
  throw "Single executable package failed, missing: $singleExePath"
}

Write-Host "Desktop package created: $exePath"
Write-Host "Single executable created: $singleExePath"

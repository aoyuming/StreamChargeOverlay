Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$distRoot = Join-Path $root "dist"
$packageDir = Join-Path $distRoot "server-package"
$zipPath = Join-Path $distRoot "sponsor-overlay-server-package.zip"

Write-Host "Building production client..."
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

New-Item -ItemType Directory -Path $distRoot -Force | Out-Null

if (Test-Path $packageDir) {
  $resolvedDistRoot = Resolve-Path $distRoot
  $resolvedPackageDir = Resolve-Path $packageDir
  if (!$resolvedPackageDir.Path.StartsWith($resolvedDistRoot.Path)) {
    throw "Refusing to delete unexpected package path: $($resolvedPackageDir.Path)"
  }

  Remove-Item -LiteralPath $resolvedPackageDir.Path -Recurse -Force
}

New-Item -ItemType Directory -Path $packageDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageDir "src") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageDir "dist") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageDir "data") | Out-Null

Copy-Item -LiteralPath (Join-Path $root "package.json") -Destination $packageDir
Copy-Item -LiteralPath (Join-Path $root "package-lock.json") -Destination $packageDir
Copy-Item -LiteralPath (Join-Path $root "tsconfig.json") -Destination $packageDir
Copy-Item -LiteralPath (Join-Path $root "src/server") -Destination (Join-Path $packageDir "src/server") -Recurse
Copy-Item -LiteralPath (Join-Path $root "src/shared") -Destination (Join-Path $packageDir "src/shared") -Recurse
Copy-Item -LiteralPath (Join-Path $root "dist/client") -Destination (Join-Path $packageDir "dist/client") -Recurse

Remove-Item -LiteralPath (Join-Path $packageDir "src/server/__tests__") -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $packageDir "src/shared/__tests__") -Recurse -Force -ErrorAction SilentlyContinue

New-Item -ItemType Directory -Path (Join-Path $packageDir "data/avatars") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageDir "data/speech") -Force | Out-Null

$readmeLines = @(
  "Sponsor overlay production server package",
  "",
  "Upload everything inside this folder to your cloud server, for example /opt/sponsor-overlay.",
  "",
  "First deployment:",
  "1. cd /opt/sponsor-overlay",
  "2. npm ci --omit=dev",
  "3. NODE_ENV=production PORT=3000 ADMIN_VIEWER_PASSWORD=viewer-password ADMIN_SUPER_PASSWORD=admin-password SESSION_SECRET=a-long-random-string npm start",
  "",
  "Useful URLs:",
  "- Display: http://SERVER_IP:3000/display.html",
  "- Admin: http://SERVER_IP:3000/admin.html",
  "- Room display: http://SERVER_IP:3000/rooms/wenrou/display.html",
  "",
  "Notes:",
  "- Do not upload node_modules. Install dependencies on the server with npm ci --omit=dev.",
  "- The data folder stores the database, avatars, and speech files.",
  "- When updating the server later, back up the data folder before replacing files."
)

Set-Content -LiteralPath (Join-Path $packageDir "README-deploy.txt") -Value $readmeLines -Encoding UTF8

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $packageDir "*") -DestinationPath $zipPath -Force

Write-Host "Server package folder: $packageDir"
Write-Host "Server package zip: $zipPath"

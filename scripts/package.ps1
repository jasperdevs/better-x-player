param(
  [string]$Name = "betterXplayer"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$staging = Join-Path $dist "_staging"
$legacyPatterns = @(
  "$Name*.zip",
  "$Name*.xpi"
)
$packageItems = @(
  "manifest.json",
  "content",
  "popup",
  "shared",
  "icons"
)

if (Test-Path $dist) {
  Remove-Item -LiteralPath $dist -Recurse -Force
}

New-Item -ItemType Directory -Path $dist | Out-Null
New-Item -ItemType Directory -Path $staging | Out-Null

foreach ($pattern in $legacyPatterns) {
  Get-ChildItem -Path $root -Filter $pattern -File -ErrorAction SilentlyContinue | Remove-Item -Force
}

foreach ($item in $packageItems) {
  Copy-Item -LiteralPath (Join-Path $root $item) -Destination $staging -Recurse -Force
}

$chromeZip = Join-Path $dist "$Name-chrome.zip"
$firefoxXpi = Join-Path $dist "$Name-firefox.xpi"

[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $chromeZip)
Copy-Item -LiteralPath $chromeZip -Destination $firefoxXpi -Force

Remove-Item -LiteralPath $staging -Recurse -Force

Write-Output "Created:"
Write-Output $chromeZip
Write-Output $firefoxXpi

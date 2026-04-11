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
$firefoxZip = Join-Path $dist "$Name-firefox.zip"
$firefoxXpi = Join-Path $dist "$Name-firefox.xpi"

$python = @'
from pathlib import Path
import zipfile

root = Path(r"__STAGING__")
targets = [
    Path(r"__CHROME__"),
    Path(r"__FIREFOX_ZIP__"),
]

for target in targets:
    if target.exists():
        target.unlink()
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(root.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(root).as_posix())
'@

$python = $python.Replace("__STAGING__", $staging.Replace("\", "\\"))
$python = $python.Replace("__CHROME__", $chromeZip.Replace("\", "\\"))
$python = $python.Replace("__FIREFOX_ZIP__", $firefoxZip.Replace("\", "\\"))

$python | python -
Copy-Item -LiteralPath $firefoxZip -Destination $firefoxXpi -Force

Remove-Item -LiteralPath $staging -Recurse -Force

Write-Output "Created:"
Write-Output $chromeZip
Write-Output $firefoxZip
Write-Output $firefoxXpi

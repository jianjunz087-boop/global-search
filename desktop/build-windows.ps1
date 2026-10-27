$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot
npx electron-builder --win --x64 --dir
if ($LASTEXITCODE -ne 0) { throw 'Electron application packaging failed' }
$nsis = Join-Path ${env:ProgramFiles(x86)} 'NSIS\makensis.exe'
if (!(Test-Path $nsis)) {
  choco install nsis --yes --no-progress
  if ($LASTEXITCODE -ne 0) { throw 'Verified NSIS installation failed' }
}
if (!(Test-Path $nsis)) { throw 'NSIS compiler not found' }
$version = (Get-Content (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
$output = Join-Path $projectRoot "dist/windows/BAIHUA-AI-TRADE-Setup-$version-win-x64.exe"
$script = Join-Path $PSScriptRoot 'installer.nsi'
& $nsis '/V2' "/DPROJECT_DIR=$projectRoot" "/XOutFile $output" "/DAPP_VERSION=$version" $script
if ($LASTEXITCODE -ne 0) { throw 'NSIS installer compilation failed' }
if (!(Test-Path $output)) { throw 'Installer missing' }

param(
  [Parameter(Mandatory = $true)]
  [string]$ZipPath,
  [string]$InstallDir = "C:\Services\dahua-adapter",
  [string]$TaskName = "dahua-adapter",
  [string]$NodePath = "node"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ZipPath)) {
  throw "Zip archive not found: $ZipPath"
}

if ($NodePath -eq "node") {
  $nodeCommand = Get-Command node -ErrorAction Stop
  $NodePath = $nodeCommand.Source
}

$nodeMajor = & $NodePath -p "process.versions.node.split('.')[0]"
if ($nodeMajor -ne "20") {
  throw "Node.js 20 LTS is required. Current major: $nodeMajor"
}

New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force

$envFile = Join-Path $InstallDir ".env"
$envExampleFile = Join-Path $InstallDir ".env.example"
if (-not (Test-Path $envFile) -and (Test-Path $envExampleFile)) {
  Copy-Item $envExampleFile $envFile
}

$taskCommand = "cmd /c `"cd /d `"$InstallDir`" && `"$NodePath`" dist\src\index.js`""

schtasks /Delete /TN $TaskName /F 2>$null | Out-Null
schtasks /Create /TN $TaskName /SC ONSTART /TR $taskCommand /RU SYSTEM /RL HIGHEST /F | Out-Null
schtasks /Run /TN $TaskName | Out-Null
schtasks /Query /TN $TaskName /V /FO LIST

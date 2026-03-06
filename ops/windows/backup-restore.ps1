param(
  [Parameter(Mandatory = $true)]
  [string]$BackupDir,
  [string]$AdapterRoot = $env:ADAPTER_ROOT,
  [string]$SafetyDir = $env:BACKUP_SAFETY_DIR,
  [string]$StopCommand = $env:ADAPTER_STOP_CMD,
  [string]$StartCommand = $env:ADAPTER_START_CMD,
  [string]$HealthcheckCommand = $env:ADAPTER_HEALTHCHECK_CMD
)

$ErrorActionPreference = "Stop"

if (-not $AdapterRoot) {
  $AdapterRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}
if (-not $SafetyDir) {
  $SafetyDir = Join-Path $AdapterRoot "backups\_safety"
}

if ($StopCommand) {
  & powershell -NoProfile -Command $StopCommand
}

& node `
  (Join-Path $AdapterRoot "dist\src\ops\backup\backup-cli.js") `
  restore `
  --root $AdapterRoot `
  --backup $BackupDir `
  --safety-dir $SafetyDir `
  --service-stopped

if ($StartCommand) {
  & powershell -NoProfile -Command $StartCommand
}

if ($HealthcheckCommand) {
  & powershell -NoProfile -Command $HealthcheckCommand
}

param(
  [string]$AdapterRoot = $env:ADAPTER_ROOT,
  [string]$BackupsDir = $env:BACKUPS_DIR,
  [string]$Mode = $env:BACKUP_MODE,
  [string]$LicenseDir = $env:BACKUP_LICENSE_DIR,
  [string]$RestorePointId = $env:BACKUP_RESTORE_POINT_ID,
  [int]$MaxLogFiles = $(if ($env:BACKUP_LOG_FILES) { [int]$env:BACKUP_LOG_FILES } else { 5 }),
  [switch]$IncludeLogs = $(if ($env:BACKUP_INCLUDE_LOGS -eq "true") { $true } else { $false })
)

$ErrorActionPreference = "Stop"

if (-not $AdapterRoot) {
  $AdapterRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}
if (-not $BackupsDir) {
  $BackupsDir = Join-Path $AdapterRoot "backups"
}
if (-not $Mode) {
  $Mode = "nightly"
}

$args = @(
  (Join-Path $AdapterRoot "dist\src\ops\backup\backup-cli.js"),
  "create",
  "--root", $AdapterRoot,
  "--backups-dir", $BackupsDir,
  "--mode", $Mode,
  "--max-log-files", "$MaxLogFiles"
)

if ($IncludeLogs) {
  $args += "--include-logs"
}
if ($LicenseDir) {
  $args += @("--license-dir", $LicenseDir)
}
if ($RestorePointId) {
  $args += @("--restore-point-id", $RestorePointId)
}

& node @args

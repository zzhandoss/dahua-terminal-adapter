param(
  [string]$AdapterRoot = $env:ADAPTER_ROOT,
  [string]$BackupsDir = $env:BACKUPS_DIR,
  [int]$NightlyKeep = $(if ($env:BACKUP_NIGHTLY_KEEP) { [int]$env:BACKUP_NIGHTLY_KEEP } else { 7 }),
  [int]$PreUpdateKeep = $(if ($env:BACKUP_PREUPDATE_KEEP) { [int]$env:BACKUP_PREUPDATE_KEEP } else { 5 }),
  [int]$LogKeep = $(if ($env:BACKUP_LOG_KEEP) { [int]$env:BACKUP_LOG_KEEP } else { 1 })
)

$ErrorActionPreference = "Stop"

if (-not $AdapterRoot) {
  $AdapterRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
}
if (-not $BackupsDir) {
  $BackupsDir = Join-Path $AdapterRoot "backups"
}

& node `
  (Join-Path $AdapterRoot "dist\src\ops\backup\backup-cli.js") `
  prune `
  --backups-dir $BackupsDir `
  --nightly-keep "$NightlyKeep" `
  --pre-update-keep "$PreUpdateKeep" `
  --log-backups-keep "$LogKeep"

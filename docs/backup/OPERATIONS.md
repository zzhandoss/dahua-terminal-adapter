# Backup Operations

## Recommended policy

- nightly: state + config, logs optional
- pre-update: state + config + recent logs

## Linux wrappers

- `ops/linux/backup-create.sh`
- `ops/linux/backup-prune.sh`
- `ops/linux/backup-restore.sh <backup-dir>`

Optional environment hooks:

- `ADAPTER_STOP_CMD`
- `ADAPTER_START_CMD`
- `ADAPTER_HEALTHCHECK_CMD`
- `BACKUPS_DIR`
- `BACKUP_INCLUDE_LOGS`
- `BACKUP_LICENSE_DIR`

## Windows wrappers

- `ops/windows/backup-create.ps1`
- `ops/windows/backup-prune.ps1`
- `ops/windows/backup-restore.ps1 -BackupDir <dir>`

Optional environment hooks:

- `ADAPTER_STOP_CMD`
- `ADAPTER_START_CMD`
- `ADAPTER_HEALTHCHECK_CMD`
- `BACKUPS_DIR`
- `BACKUP_INCLUDE_LOGS`
- `BACKUP_LICENSE_DIR`

## Restore flow

1. Stop the service through supervisor-specific stop command.
2. Run CLI verify or wrapper restore.
3. The CLI writes a safety copy under `backups/_safety/`.
4. Restore copies bundle state over current adapter state.
5. Start the service again.
6. Run healthcheck.

## Notes

- Backups assume adapter state lives under the install root.
- SQLite runs in WAL mode, so the adapter section captures the whole state directory, not only `.db`.
- `prune` can trim old log attachments separately from state bundles.

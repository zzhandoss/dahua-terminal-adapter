# Backup CLI

`dahua-adapter` now ships an internal backup CLI for adapter-local state.

Covered state:

- adapter SQLite state from `SQLITE_PATH` parent directory
- `.env`
- optional license directory
- optional recent logs from `LOG_DIR`

Bundle format:

- `manifest.json`
- `checksums.txt`
- `adapter/`
- `config/`
- `license/`
- `logs/`

CLI entrypoint in production bundle:

```bash
node dist/src/ops/backup/backup-cli.js <create|verify|restore|prune>
```

Runtime package scripts:

```bash
pnpm run backup:create
pnpm run backup:verify -- --backup ./backups/<restore-point>
pnpm run backup:restore -- --backup ./backups/<restore-point> --service-stopped
pnpm run backup:prune -- --backups-dir ./backups
```

Development convenience scripts with rebuild:

```bash
pnpm run backup:create:dev
pnpm run backup:verify:dev -- --backup ./backups/<restore-point>
pnpm run backup:restore:dev -- --backup ./backups/<restore-point> --service-stopped
pnpm run backup:prune:dev -- --backups-dir ./backups
```

Important restore rule:

- `restore` requires explicit `--service-stopped`

Compatibility rule:

- backup verification is exact-version by default
- override only with `--allow-version-mismatch`

# Release Context Thread

## Goal

Prepare `dahua-adapter` for production deployment on Windows and Linux without Docker, using release archives.

## Decisions

- Git platform: GitHub.
- Release trigger: stable tags only, format `vX.Y.Z`.
- Version source: `package.json`.
- Runtime policy: system Node.js 20 LTS.
- Target artifacts: `source.zip`, `win-x64.zip`, `linux-x64.zip`, `SHA256SUMS.txt`.
- Build origin: native per OS runner.
- `.env` is never included in build zip; only `.env.example`.

## Constraints

- No Docker-based packaging.
- Keep runtime API behavior unchanged.
- Keep release automation deterministic and reproducible.

## Notes

- `better-sqlite3` is native; runtime archives are built on target OS in CI matrix.
- Install scripts configure service startup:
  - Linux: `systemd`
  - Windows: Task Scheduler

# Release Artifacts

## Names

- `dahua-adapter-vX.Y.Z-source.zip`
- `dahua-adapter-vX.Y.Z-win-x64.zip`
- `dahua-adapter-vX.Y.Z-linux-x64.zip`
- `dahua-adapter-vX.Y.Z-SHA256SUMS.txt`

## `source.zip`

Contains source files and project metadata required for development/rebuild.

Excludes runtime/private data:

- `.env`
- `node_modules/`
- `dist/`
- `data/`
- `release/out`
- `release/staging`

## `win-x64` and `linux-x64` build zips

Contain production runtime bundle:

- `dist/`
- production `node_modules/`
- `package.json`
- `pnpm-lock.yaml`
- `.env.example`
- `VERSION`
- `BUILD_INFO.json`
- OS-specific install/control scripts

Do not include:

- `src/`
- `test/`
- `.env`
- runtime DB files

## Checksums

`SHA256SUMS.txt` is generated from all zip artifacts in the release output directory.

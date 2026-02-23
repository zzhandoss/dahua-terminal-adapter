# Release Process

## Versioning

- Version source: `package.json` (`X.Y.Z`)
- Release tag: `vX.Y.Z`
- CI checks that `tag == v + package.json.version`

## Trigger release

1. Update `package.json` version.
2. Push commit.
3. Create and push tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

## CI workflow result

GitHub Actions workflow `Release` publishes:

- source zip
- Windows build zip
- Linux build zip
- SHA256 checksum file

## Validation gates in CI

- `pnpm run lint`
- `pnpm run typecheck`
- `pnpm run test`
- build and packaging on each target OS

## Rollback

Deploy the previous release build zip and restart service/task.

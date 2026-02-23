# Linux Install (zip)

## Requirements

- Linux `x64`
- Node.js 20 LTS available as `node`
- `unzip`
- root permissions for service registration

## Install

1. Download `dahua-adapter-vX.Y.Z-linux-x64.zip`.
2. Run:

```bash
sudo bash scripts/install/linux/install.sh --zip /path/to/dahua-adapter-vX.Y.Z-linux-x64.zip --dir /opt/dahua-adapter --service-name dahua-adapter
```

3. Update `/opt/dahua-adapter/.env` with production values.
4. Restart service:

```bash
sudo systemctl restart dahua-adapter
```

## Service control

```bash
sudo bash /opt/dahua-adapter/scripts/install/linux/control.sh status dahua-adapter
sudo bash /opt/dahua-adapter/scripts/install/linux/control.sh logs dahua-adapter
```

## Upgrade

Run `install.sh` again with a new zip and the same `--dir` and `--service-name`.

# Windows Install (zip)

## Requirements

- Windows `x64`
- Node.js 20 LTS available in `PATH`
- PowerShell with permission to manage scheduled tasks

## Install

1. Download `dahua-adapter-vX.Y.Z-win-x64.zip`.
2. Run PowerShell as Administrator.
3. Execute:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install\windows\install.ps1 -ZipPath C:\path\dahua-adapter-vX.Y.Z-win-x64.zip -InstallDir C:\Services\dahua-adapter -TaskName dahua-adapter
```

4. Edit `C:\Services\dahua-adapter\.env` with production values.
5. Restart task:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Services\dahua-adapter\scripts\install\windows\control.ps1 -Action stop -TaskName dahua-adapter
powershell -ExecutionPolicy Bypass -File C:\Services\dahua-adapter\scripts\install\windows\control.ps1 -Action start -TaskName dahua-adapter
```

## Task control

```powershell
powershell -ExecutionPolicy Bypass -File C:\Services\dahua-adapter\scripts\install\windows\control.ps1 -Action status -TaskName dahua-adapter
```

## Upgrade

Run `install.ps1` again with a new zip and the same install directory/task name.

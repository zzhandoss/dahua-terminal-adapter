Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-AdapterRoot {
  (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Invoke-BackupCli {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  $root = Get-AdapterRoot
  & node (Join-Path $root "dist\src\ops\backup\backup-cli.js") @Arguments
}

function Invoke-ExternalCommandString {
  param(
    [string]$Command
  )

  if ([string]::IsNullOrWhiteSpace($Command)) {
    return
  }

  & powershell -NoProfile -ExecutionPolicy Bypass -Command $Command
}

function Wait-AdapterHealth {
  param(
    [string]$Url,
    [int]$TimeoutSec = 60
  )

  if ([string]::IsNullOrWhiteSpace($Url)) {
    return
  }

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 | Out-Null
      return
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "healthcheck timeout: $Url"
}

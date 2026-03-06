param(
  [Parameter(Mandatory = $true)]
  [string]$Backup,
  [string]$Root,
  [switch]$AllowVersionMismatch
)

. (Join-Path $PSScriptRoot "Common.ps1")

$args = @("verify", "--backup", $Backup)
if ($Root) { $args += @("--root", $Root) }
if ($AllowVersionMismatch) { $args += "--allow-version-mismatch" }

Invoke-BackupCli -Arguments $args

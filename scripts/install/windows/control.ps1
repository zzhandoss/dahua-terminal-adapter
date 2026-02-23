param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("start", "stop", "status", "uninstall-task")]
  [string]$Action,
  [string]$TaskName = "dahua-adapter"
)

$ErrorActionPreference = "Stop"

switch ($Action) {
  "start" {
    schtasks /Run /TN $TaskName | Out-Null
  }
  "stop" {
    schtasks /End /TN $TaskName | Out-Null
  }
  "status" {
    schtasks /Query /TN $TaskName /V /FO LIST
  }
  "uninstall-task" {
    schtasks /Delete /TN $TaskName /F | Out-Null
  }
}

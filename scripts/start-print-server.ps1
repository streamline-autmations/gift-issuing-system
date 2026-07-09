param(
  [string]$PrinterName = "",
  [switch]$ListPrinters
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if ($ListPrinters) {
  try {
    Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus
  } catch {
    Write-Host "Get-Printer failed, trying WMIC printer listing..."
    wmic path Win32_Printer get Name,DriverName,PortName,PrinterStatus
  }
  exit 0
}

if ($PrinterName.Trim()) {
  $env:PRINTER_NAME = $PrinterName.Trim()
}

if (-not $env:PRINTER_NAME) {
  Write-Host "No PRINTER_NAME is set."
  Write-Host "Run this to list Windows printer names:"
  Write-Host '  .\scripts\start-print-server.ps1 -ListPrinters'
  Write-Host "Then run:"
  Write-Host '  .\scripts\start-print-server.ps1 -PrinterName "Exact Printer Name"'
  exit 1
}

Write-Host "Starting print server for printer: $env:PRINTER_NAME"
Write-Host "Project folder: $repoRoot"
node print-server.cjs

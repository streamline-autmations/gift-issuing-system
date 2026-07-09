# Printing Setup Workflow

Use this on each issuing computer. Each computer can use its own slip printer.

## 1. Connect The Slip Printer
Connect the slip printer to Windows first.

Open Windows Settings:

```text
Bluetooth & devices -> Printers & scanners
```

Confirm the printer appears and can print a Windows test page.

## 2. Find The Exact Printer Name
Open PowerShell in the project folder and run:

```powershell
.\scripts\start-print-server.ps1 -ListPrinters
```

Copy the exact printer name from the `Name` column.

## 3. Start The Print Server
Run this with the exact printer name for that computer:

```powershell
.\scripts\start-print-server.ps1 -PrinterName "Your Slip Printer Name"
```

Example:

```powershell
.\scripts\start-print-server.ps1 -PrinterName "XP-80C"
```

Keep the PowerShell window open while issuing gifts.

## 4. Use The Issuing App
Open the deployed app:

```text
https://issuing-system.netlify.app
```

When a gift is issued, the browser sends the slip to:

```text
http://localhost:4242/print
```

The local print server then sends the job to the printer configured on that computer.

## Optional: Use `.env` Per Computer
Instead of passing `-PrinterName` every time, create a local `.env` file in the project folder:

```env
PRINTER_NAME="Your Slip Printer Name"
PRINT_SERVER_PORT="4242"
PRINT_ALLOWED_ORIGIN="https://issuing-system.netlify.app"
```

Then start with:

```powershell
node print-server.cjs
```

`.env` is ignored by git, so each computer can keep its own printer name.

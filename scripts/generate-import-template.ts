import * as XLSX from 'xlsx'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

function main() {
  const outDir = join(process.cwd(), 'templates')
  mkdirSync(outDir, { recursive: true })

  const wb = XLSX.utils.book_new()

  const headers = [
    'employee_number',
    'first_name',
    'last_name',
    'mine',
    'department',
    'shift',
    'crew',
    'job_title',
  ]

  const exampleRows = [
    headers,
    ['10001', 'John', 'Doe', 'Shaft 1', 'Engineering', 'Day', 'A', 'Operator'],
    ['10002', 'Jane', 'Smith', 'Shaft 1', 'Operations', 'Night', 'B', 'Supervisor'],
  ]

  const wsEmployees = XLSX.utils.aoa_to_sheet(exampleRows)
  wsEmployees['!freeze'] = { xSplit: 0, ySplit: 1 }
  wsEmployees['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }))
  XLSX.utils.book_append_sheet(wb, wsEmployees, 'Employees')

  const instructions = [
    ['How to use this template'],
    ['1) Keep row 1 as headers (do not rename them).'],
    ['2) Paste employee rows starting from row 2.'],
    ['3) You can add extra columns to the right; they will be saved as extra_data.'],
    ['4) Do not use merged cells.'],
    ['5) Save as .xlsx.'],
    [''],
    ['Import steps in the app'],
    ['Dashboard → Upload file → Mode: Employee table → Sheet: Employees'],
    ['Map employee_number (required). first_name/last_name are optional.'],
    [''],
    ['Gift qualification notes'],
    ['If you use a qualification column, matching is case-insensitive and ignores spaces/punctuation.'],
    ['Example: Powerbank, power bank, POWER-BANK will match.'],
  ]
  const wsReadme = XLSX.utils.aoa_to_sheet(instructions)
  wsReadme['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, wsReadme, 'README')

  const outPath = join(outDir, 'Master_Employee_Import_Template.xlsx')
  XLSX.writeFile(wb, outPath)
  console.log(outPath)
}

main()



import * as XLSX from 'xlsx'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length]
}

function main() {
  const outDir = join(process.cwd(), 'templates')
  mkdirSync(outDir, { recursive: true })

  const wb = XLSX.utils.book_new()

  const mines = ['Test Mine - Shaft 1', 'Test Mine - Shaft 2', 'Test Mine - Shaft 3']
  const departments = ['Operations', 'Engineering', 'Safety', 'Processing']
  const shifts = ['Day', 'Night']
  const crews = ['A', 'B', 'C', 'D']
  const jobTitles = ['Operator', 'Artisan', 'Supervisor', 'Team Lead']

  const firstNames = [
    'John',
    'Jane',
    'Thabo',
    'Lerato',
    'Sipho',
    'Nomsa',
    'Michael',
    'Sarah',
    'David',
    'Emily',
    'Daniel',
    'Priya',
    'Ahmed',
    'Fatima',
    'Jacob',
    'Olivia',
  ]

  const lastNames = [
    'Dlamini',
    'Nkosi',
    'Mokoena',
    'Naidoo',
    'Van Wyk',
    'Botha',
    'Smith',
    'Johnson',
    'Khan',
    'Patel',
    'Brown',
    'Williams',
    'Jones',
    'Taylor',
    'Lee',
    'Martin',
  ]

  const headers = ['employee_number', 'first_name', 'last_name', 'mine', 'department', 'shift', 'crew', 'job_title']

  const employees: {
    employee_number: string
    first_name: string
    last_name: string
    mine: string
    department: string
    shift: string
    crew: string
    job_title: string
  }[] = []

  for (let i = 1; i <= 100; i++) {
    const employee_number = `Z${String(i).padStart(7, '0')}`
    const first_name = pick(firstNames, i)
    const last_name = pick(lastNames, i * 7)
    const mine = pick(mines, i)
    const department = pick(departments, i * 3)
    const shift = pick(shifts, i)
    const crew = pick(crews, i * 5)
    const job_title = pick(jobTitles, i * 2)

    employees.push({ employee_number, first_name, last_name, mine, department, shift, crew, job_title })
  }

  // 1. Employees Sheet
  const employeesSheetName = 'Employees'
  const wsEmployees = XLSX.utils.aoa_to_sheet([
    [
      'employee_number',
      'first_name',
      'last_name',
      'mine',
      'department',
      'shift',
      'crew',
      'job_title',
      '60 Day Bonus', // Qualification Column
    ],
    ...employees.map((e, index) => [
      e.employee_number,
      e.first_name,
      e.last_name,
      e.mine,
      e.department,
      e.shift,
      e.crew,
      e.job_title,
      index < 50 ? 'YES' : 'NO', // First 50 get YES, others get NO
    ]),
  ])
  wsEmployees['!freeze'] = { xSplit: 0, ySplit: 1 }
  XLSX.utils.book_append_sheet(wb, wsEmployees, employeesSheetName)

  const mineListSheet = [['Mine Name'], ...mines.map((m) => [m])]
  const wsMines = XLSX.utils.aoa_to_sheet(mineListSheet)
  ;(wsMines as any)['!freeze'] = { xSplit: 0, ySplit: 1 }
  ;(wsMines as any)['!cols'] = [{ wch: 26 }]
  XLSX.utils.book_append_sheet(wb, wsMines, 'Mine List')

  // 4. Instructions
  const instructions = [
    ['Test Data Setup Instructions (Single Sheet Method)'],
    ['1) Admin > Issuings: Create a test issuing'],
    ['2) Admin > Gifts: Create 2 slots:'],
    ['   - Slot Name: "Mandatory Gift" (Fixed) -> Option: "Powerbank"'],
    ['   - Slot Name: "60 Day Bonus" (Fixed) -> Option: "Smart Watch"'],
    ['3) Dashboard > Import > Employee table > Select "Employees" sheet'],
    ['4) Map Columns step: Just map employee_number etc.'],
    ['5) Map Gift Slots step (see image):'],
    ['   - Mandatory Gift: Select "All employees qualify"'],
    ['   - 60 Day Bonus: Select "Qualification column"'],
    ['     - Column: "60 Day Bonus"'],
    ['     - Qualifies when value equals: "YES"'],
  ]
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions)
  ;(wsInstructions as any)['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'README')

  const outPath = join(outDir, 'Test_100_Employees_Powerbanks_Smartwatches.xlsx')
  XLSX.writeFile(wb, outPath)
  console.log(outPath)
}

main()

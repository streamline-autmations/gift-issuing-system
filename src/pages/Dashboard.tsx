import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

type Company = {
  id: string
  name: string
}

type Issuing = {
  id: string
  company_id: string
  name: string
  mine_name: string
  is_active: boolean
}

type GiftSlot = {
  id: string
  name: string
  is_choice: boolean
}

type ParsedExcel = {
  headers: string[]
  rows: Record<string, unknown>[]
}

type ParsedWorkbook = {
  sheetNames: string[]
  sheets: Record<string, ParsedExcel>
}

type ColumnMapping = {
  employee_number: string
  first_name: string | null
  last_name: string | null
}

type SlotRule =
  | { mode: 'all' }
  | { mode: 'column'; column: string; value: string }

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value).trim()
}

function normalizeKey(value: unknown) {
  return normalizeCell(value).toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function safeHeader(value: unknown, fallback: string) {
  const s = normalizeCell(value)
  return s ? s : fallback
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function StepPill({ active, label }: { active: boolean; label: string }) {
  return (
    <div
      className={
        active
          ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'
          : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700'
      }
    >
      {label}
    </div>
  )
}

function TablePreview({ headers, rows }: { headers: string[]; rows: Record<string, unknown>[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx} className="border-t border-slate-100">
              {headers.map((h) => (
                <td key={h} className="whitespace-nowrap px-4 py-3 text-slate-700">
                  {normalizeCell(r[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExcelImport() {
  const qc = useQueryClient()

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [importMode, setImportMode] = useState<'table' | 'giftSheets'>('table')

  const [companyId, setCompanyId] = useState('')
  const [issuingId, setIssuingId] = useState('')

  const companiesQuery = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name')
      if (error) throw error
      return (data ?? []) as Company[]
    },
  })

  const issuingsQuery = useQuery({
    queryKey: ['issuings', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issuings')
        .select('id, company_id, name, mine_name, is_active')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Issuing[]
    },
  })

  const giftSlotsQuery = useQuery({
    queryKey: ['gift-slots', issuingId],
    enabled: Boolean(issuingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_slots')
        .select('id, name, is_choice')
        .eq('issuing_id', issuingId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as GiftSlot[]
    },
  })

  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    employee_number: '',
    first_name: null,
    last_name: null,
  })

  const [slotRules, setSlotRules] = useState<Record<string, SlotRule>>({})
  const [sheetSlotMap, setSheetSlotMap] = useState<Record<string, string>>({})

  useEffect(() => {
    setIssuingId('')
    setStep(1)
    setWorkbook(null)
    setSelectedSheet('')
    setColumnMapping({ employee_number: '', first_name: null, last_name: null })
    setSlotRules({})
    setSheetSlotMap({})
    setImportMode('table')
  }, [companyId])

  useEffect(() => {
    setWorkbook(null)
    setSelectedSheet('')
    setColumnMapping({ employee_number: '', first_name: null, last_name: null })
    setSlotRules({})
    setSheetSlotMap({})
    setImportMode('table')
    if (step !== 1) setStep(1)
  }, [issuingId])

  useEffect(() => {
    const slots = giftSlotsQuery.data ?? []
    if (!slots.length) return

    setSlotRules((prev) => {
      const next = { ...prev }
      for (const s of slots) {
        if (!next[s.id]) next[s.id] = { mode: 'all' }
      }
      return next
    })
  }, [giftSlotsQuery.data])

  useEffect(() => {
    if (!workbook) return
    if (importMode !== 'giftSheets') return
    const slots = giftSlotsQuery.data ?? []
    if (!slots.length) return

    setSheetSlotMap((prev) => {
      const next = { ...prev }
      for (const sheetName of workbook.sheetNames) {
        if (next[sheetName]) continue
        const match = slots.find((s) => normalizeKey(s.name) === normalizeKey(sheetName))
        next[sheetName] = match?.id ?? ''
      }
      return next
    })
  }, [workbook, importMode, giftSlotsQuery.data])

  async function parseWorkbook(file: File) {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheetNames = wb.SheetNames.slice()
    const sheets: Record<string, ParsedExcel> = {}

    for (const sheetName of sheetNames) {
      const sheet = wb.Sheets[sheetName]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
      if (!raw.length) {
        sheets[sheetName] = { headers: [], rows: [] }
        continue
      }

      const headerRow = raw[0] ?? []
      const headers = headerRow.map((h, i) => safeHeader(h, `Column ${i + 1}`))

      const rows = raw.slice(1).map((r) => {
        const obj: Record<string, unknown> = {}
        for (let i = 0; i < headers.length; i++) obj[headers[i]] = r?.[i] ?? ''
        return obj
      })

      sheets[sheetName] = { headers, rows }
    }

    return { sheetNames, sheets } as ParsedWorkbook
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    const name = file.name.toLowerCase()
    if (!(name.endsWith('.xlsx') || name.endsWith('.xls'))) {
      setWorkbook(null)
      return
    }

    parseWorkbook(file)
      .then((parsed) => {
        setWorkbook(parsed)
        const first = parsed.sheetNames[0] ?? ''
        setSelectedSheet(first)
        setColumnMapping({ employee_number: '', first_name: null, last_name: null })
        setSheetSlotMap({})
      })
      .catch(() => {
        setWorkbook(null)
      })
  }

  const sheetData = useMemo(() => {
    if (!workbook) return null
    const name = selectedSheet || workbook.sheetNames[0] || ''
    if (!name) return null
    return workbook.sheets[name] ?? null
  }, [workbook, selectedSheet])

  const headers = sheetData?.headers ?? []
  const rows = sheetData?.rows ?? []

  const resolvedPreview = useMemo(() => {
    if (!sheetData) return [] as Array<{ employee_number: string; first_name: string; last_name: string; slots: string[] }>
    if (!columnMapping.employee_number) return [] as Array<{ employee_number: string; first_name: string; last_name: string; slots: string[] }>
    const slotNameById = new Map((giftSlotsQuery.data ?? []).map((s) => [s.id, s.name]))
    const rules = slotRules
    const employeeCol = columnMapping.employee_number
    const firstCol = columnMapping.first_name
    const lastCol = columnMapping.last_name

    return rows.slice(0, 10).map((r) => {
      const employee_number = normalizeCell(r[employeeCol])
      const first_name = firstCol ? normalizeCell(r[firstCol]) : ''
      const last_name = lastCol ? normalizeCell(r[lastCol]) : ''

      const slots: string[] = []
      for (const s of giftSlotsQuery.data ?? []) {
        const rule = rules[s.id]
        if (!rule) continue
        if (rule.mode === 'all') {
          slots.push(slotNameById.get(s.id) ?? s.id)
          continue
        }
        const cell = normalizeCell(r[rule.column])
        const expected = normalizeCell(rule.value)
        if (cell && expected && normalizeKey(cell) === normalizeKey(expected)) {
          slots.push(slotNameById.get(s.id) ?? s.id)
        }
      }
      return { employee_number, first_name, last_name, slots }
    })
  }, [sheetData, rows, giftSlotsQuery.data, slotRules, columnMapping])

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!workbook) throw new Error('No file')
      if (!companyId || !issuingId) throw new Error('Select company and issuing')

      if (importMode === 'giftSheets') {
        const chosen = Object.entries(sheetSlotMap).filter(([, slotId]) => Boolean(slotId))
        if (chosen.length === 0) throw new Error('Map at least one sheet to a gift slot.')

        const keyToOriginal = new Map<string, string>()
        const sheetEmployeeNumbers = new Map<string, string[]>() // sheetName -> employee_numbers (original)

        for (const [sheetName] of chosen) {
          const parsed = workbook.sheets[sheetName]
          const list: string[] = []

          const headerCandidate = normalizeCell(parsed.headers[0] ?? '')
          if (headerCandidate && /[0-9]/.test(headerCandidate) && headerCandidate.length <= 20) {
            const key = headerCandidate.toLowerCase()
            if (!keyToOriginal.has(key)) keyToOriginal.set(key, headerCandidate)
            list.push(headerCandidate)
          }

          const firstHeader = parsed.headers[0]
          for (const r of parsed.rows) {
            const rawVal = firstHeader ? r[firstHeader] : undefined
            const empNum = normalizeCell(rawVal)
            if (!empNum) continue
            const key = empNum.toLowerCase()
            if (!keyToOriginal.has(key)) keyToOriginal.set(key, empNum)
            list.push(empNum)
          }

          sheetEmployeeNumbers.set(sheetName, list)
        }

        const allEmployeeNumbersOriginal = Array.from(keyToOriginal.values())

        const existingMap = new Map<string, { id: string; employee_number: string }>()
        for (const c of chunk(allEmployeeNumbersOriginal, 500)) {
          const { data, error } = await supabase
            .from('employees')
            .select('id, employee_number')
            .eq('issuing_id', issuingId)
            .in('employee_number', c)
          if (error) throw error
          for (const row of data ?? []) existingMap.set(String(row.employee_number).toLowerCase(), { id: row.id, employee_number: row.employee_number })
        }

        const toInsert = allEmployeeNumbersOriginal
          .filter((empNum) => !existingMap.has(empNum.toLowerCase()))
          .map((empNum) => ({ id: crypto.randomUUID(), employee_number: empNum }))

        const insertedEmployees: Array<{ id: string; employee_number: string }> = []
        for (const batch of chunk(toInsert, 500)) {
          const payload = batch.map((b) => ({
            id: b.id,
            company_id: companyId,
            issuing_id: issuingId,
            employee_number: b.employee_number,
            first_name: null,
            last_name: null,
            extra_data: {},
          }))
          const { data, error } = await supabase
            .from('employees')
            .upsert(payload, { onConflict: 'issuing_id,employee_number', ignoreDuplicates: true })
            .select('id, employee_number')
          if (error) throw error
          for (const e of data ?? []) insertedEmployees.push({ id: e.id, employee_number: e.employee_number })
        }

        const allEmployeesByNumber = new Map<string, { id: string; employee_number: string }>(existingMap)
        for (const e of insertedEmployees) allEmployeesByNumber.set(String(e.employee_number).toLowerCase(), e)

        const employeeSlotsRows: Array<{ id: string; employee_id: string; slot_id: string; company_id: string }> = []
        for (const [sheetName, list] of sheetEmployeeNumbers.entries()) {
          const slotId = sheetSlotMap[sheetName]
          if (!slotId) continue
          for (const empNum of list) {
            const emp = allEmployeesByNumber.get(empNum.toLowerCase())
            if (!emp) continue
            employeeSlotsRows.push({ id: crypto.randomUUID(), employee_id: emp.id, slot_id: slotId, company_id: companyId })
          }
        }

        for (const batch of chunk(employeeSlotsRows, 1000)) {
          const { error } = await supabase
            .from('employee_slots')
            .upsert(batch, { onConflict: 'employee_id,slot_id', ignoreDuplicates: true })
          if (error) throw error
        }

        await qc.invalidateQueries({ queryKey: ['employees', issuingId] })

        return {
          foundInExcel: allEmployeeNumbersOriginal.length,
          imported: insertedEmployees.length,
          skippedDuplicatesInFile: 0,
          skippedDuplicatesExisting: existingMap.size,
          skippedMissingEmployeeNumber: 0,
        }
      }

      if (!sheetData) throw new Error('No sheet selected')
      if (!columnMapping.employee_number) throw new Error('Map employee_number')

      const employeeCol = columnMapping.employee_number
      const firstCol = columnMapping.first_name
      const lastCol = columnMapping.last_name
      const mappedCols = new Set([employeeCol, firstCol ?? '', lastCol ?? ''].filter(Boolean))

      const seen = new Set<string>()
      const normalizedRows: Array<{
        employee_number: string
        first_name: string | null
        last_name: string | null
        extra_data: Record<string, unknown>
        sourceRow: Record<string, unknown>
      }> = []
      let skippedDuplicatesInFile = 0
      let skippedMissingEmployeeNumber = 0

      for (const r of rows) {
        const employee_number = normalizeCell(r[employeeCol])
        if (!employee_number) {
          skippedMissingEmployeeNumber++
          continue
        }
        const key = employee_number.toLowerCase()
        if (seen.has(key)) {
          skippedDuplicatesInFile++
          continue
        }
        seen.add(key)

        const extra_data: Record<string, unknown> = {}
        for (const h of headers) {
          if (mappedCols.has(h)) continue
          extra_data[h] = r[h]
        }

        normalizedRows.push({
          employee_number,
          first_name: firstCol ? normalizeCell(r[firstCol]) || null : null,
          last_name: lastCol ? normalizeCell(r[lastCol]) || null : null,
          extra_data,
          sourceRow: r,
        })
      }

      const employeeNumbers = normalizedRows.map((r) => r.employee_number)

      const existing = new Set<string>()
      for (const c of chunk(employeeNumbers, 500)) {
        const { data, error } = await supabase
          .from('employees')
          .select('employee_number')
          .eq('issuing_id', issuingId)
          .in('employee_number', c)
        if (error) throw error
        for (const row of data ?? []) existing.add(String(row.employee_number).toLowerCase())
      }

      const toInsert = normalizedRows.filter((r) => !existing.has(r.employee_number.toLowerCase()))
      const skippedDuplicatesExisting = normalizedRows.length - toInsert.length

      const employeesToInsert = toInsert.map((r) => ({
        id: crypto.randomUUID(),
        company_id: companyId,
        issuing_id: issuingId,
        employee_number: r.employee_number,
        first_name: r.first_name,
        last_name: r.last_name,
        extra_data: r.extra_data,
      }))

      const insertedEmployees: Array<{ id: string; employee_number: string }> = []
      for (const batch of chunk(employeesToInsert, 500)) {
        const { data, error } = await supabase
          .from('employees')
          .upsert(batch, { onConflict: 'issuing_id,employee_number', ignoreDuplicates: true })
          .select('id, employee_number')
        if (error) throw error
        for (const e of data ?? []) insertedEmployees.push({ id: e.id, employee_number: e.employee_number })
      }

      const rowByEmployeeNumber = new Map(normalizedRows.map((r) => [r.employee_number.toLowerCase(), r.sourceRow]))

      const employeeSlotsRows: Array<{ id: string; employee_id: string; slot_id: string; company_id: string }> = []
      for (const emp of insertedEmployees) {
        const sourceRow = rowByEmployeeNumber.get(emp.employee_number.toLowerCase())
        if (!sourceRow) continue

        for (const [slotId, rule] of Object.entries(slotRules)) {
          let qualifies = false
          if (rule.mode === 'all') {
            qualifies = true
          } else {
            const cell = normalizeCell(sourceRow[rule.column])
            const expected = normalizeCell(rule.value)
            qualifies = Boolean(cell && expected && normalizeKey(cell) === normalizeKey(expected))
          }

          if (!qualifies) continue
          employeeSlotsRows.push({ id: crypto.randomUUID(), employee_id: emp.id, slot_id: slotId, company_id: companyId })
        }
      }

      for (const batch of chunk(employeeSlotsRows, 1000)) {
        const { error } = await supabase
          .from('employee_slots')
          .upsert(batch, { onConflict: 'employee_id,slot_id', ignoreDuplicates: true })
        if (error) throw error
      }

      await qc.invalidateQueries({ queryKey: ['employees', issuingId] })

      return {
        foundInExcel: rows.length,
        imported: insertedEmployees.length,
        skippedDuplicatesInFile,
        skippedDuplicatesExisting,
        skippedMissingEmployeeNumber,
      }
    },
  })

  const summary = importMutation.data
  const canGoStep2 = Boolean(companyId && issuingId)
  const canGoStep3 = Boolean(workbook)
  const canGoStep4 = importMode === 'giftSheets' ? true : Boolean(columnMapping.employee_number)
  const canConfirm =
    importMode === 'giftSheets'
      ? Object.values(sheetSlotMap).some(Boolean) && !importMutation.isPending
      : Boolean(columnMapping.employee_number) && !importMutation.isPending

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <StepPill active={step === 1} label="1. Select issuing" />
        <StepPill active={step === 2} label="2. Upload file" />
        <StepPill active={step === 3} label="3. Map columns" />
        <StepPill active={step === 4} label="4. Map gift slots" />
        <StepPill active={step === 5} label="5. Confirm" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Select issuing</h2>
              <p className="text-sm text-slate-600">Choose where these employees will be imported.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Company</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                >
                  <option value="">Select company...</option>
                  {companiesQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Issuing</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  value={issuingId}
                  onChange={(e) => setIssuingId(e.target.value)}
                  disabled={!companyId}
                >
                  <option value="">Select issuing...</option>
                  {issuingsQuery.data?.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.mine_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canGoStep2}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Upload Excel file</h2>
              <p className="text-sm text-slate-600">Upload a .xlsx or .xls file.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={
                  importMode === 'table'
                    ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'
                    : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700'
                }
                onClick={() => setImportMode('table')}
              >
                Employee table
              </button>
              <button
                type="button"
                className={
                  importMode === 'giftSheets'
                    ? 'rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'
                    : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700'
                }
                onClick={() => setImportMode('giftSheets')}
              >
                Gift sheets
              </button>
            </div>

            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                onFiles(e.dataTransfer.files)
              }}
              role="button"
              tabIndex={0}
            >
              <Upload className="h-6 w-6 text-slate-600" />
              <div className="mt-3 text-sm font-semibold text-slate-900">Drag & drop or click to upload</div>
              <div className="mt-1 text-xs text-slate-600">.xlsx or .xls</div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />

            {workbook && importMode === 'table' ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">Sheet</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                >
                  {workbook.sheetNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {sheetData && importMode === 'table' ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">Preview (first 5 rows)</div>
                <TablePreview headers={headers} rows={rows.slice(0, 5)} />
              </div>
            ) : null}

            {workbook && importMode === 'giftSheets' ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                Workbook sheets found: {workbook.sheetNames.length}. In the next step you’ll map each sheet to a gift slot.
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => setStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canGoStep3}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                onClick={() => setStep(importMode === 'table' ? 3 : 4)}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Map columns</h2>
              <p className="text-sm text-slate-600">Choose which Excel columns map to employee fields.</p>
            </div>

            {importMode === 'giftSheets' ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                This step is skipped in Gift sheets mode.
              </div>
            ) : !sheetData ? (
              <div className="text-sm text-slate-600">Upload a file and select a sheet first.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Employee number <span className="text-red-600">*</span>
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    value={columnMapping.employee_number}
                    onChange={(e) => setColumnMapping((p) => ({ ...p, employee_number: e.target.value }))}
                  >
                    <option value="">Select column...</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">First name</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    value={columnMapping.first_name ?? ''}
                    onChange={(e) => setColumnMapping((p) => ({ ...p, first_name: e.target.value || null }))}
                  >
                    <option value="">Not mapped</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Last name</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    value={columnMapping.last_name ?? ''}
                    onChange={(e) => setColumnMapping((p) => ({ ...p, last_name: e.target.value || null }))}
                  >
                    <option value="">Not mapped</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => setStep(2)}
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canGoStep4}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                onClick={() => setStep(4)}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Map gift slots</h2>
              <p className="text-sm text-slate-600">
                {importMode === 'table' ? 'Define how employees qualify for each slot.' : 'Map each sheet to a gift slot.'}
              </p>
            </div>

            {giftSlotsQuery.isLoading ? (
              <div className="text-sm text-slate-600">Loading gift slots...</div>
            ) : importMode === 'giftSheets' ? (
              workbook?.sheetNames?.length ? (
                <div className="space-y-3">
                  {workbook.sheetNames.map((sheetName) => (
                    <div key={sheetName} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_280px]">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{sheetName}</div>
                        <div className="text-xs text-slate-600">Rows: {(workbook.sheets[sheetName]?.rows ?? []).length}</div>
                      </div>
                      <div>
                        <select
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                          value={sheetSlotMap[sheetName] ?? ''}
                          onChange={(e) => setSheetSlotMap((p) => ({ ...p, [sheetName]: e.target.value }))}
                        >
                          <option value="">Ignore this sheet</option>
                          {(giftSlotsQuery.data ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-600">Upload a workbook first.</div>
              )
            ) : giftSlotsQuery.data?.length ? (
              <div className="space-y-4">
                {giftSlotsQuery.data.map((slot) => {
                  const rule = slotRules[slot.id] ?? { mode: 'all' }
                  return (
                    <div key={slot.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{slot.name}</div>
                          <div className="text-xs text-slate-600">{slot.is_choice ? 'Choice slot' : 'Fixed slot'}</div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        <label className="flex items-start gap-3">
                          <input
                            type="radio"
                            name={`slot-${slot.id}`}
                            checked={rule.mode === 'all'}
                            onChange={() => setSlotRules((p) => ({ ...p, [slot.id]: { mode: 'all' } }))}
                          />
                          <div>
                            <div className="text-sm font-medium text-slate-900">All employees qualify</div>
                            <div className="text-xs text-slate-600">Everyone imported into this issuing gets this slot.</div>
                          </div>
                        </label>

                        <label className="flex items-start gap-3">
                          <input
                            type="radio"
                            name={`slot-${slot.id}`}
                            checked={rule.mode === 'column'}
                            onChange={() =>
                              setSlotRules((p) => ({
                                ...p,
                                [slot.id]: { mode: 'column', column: headers[0] ?? '', value: '' },
                              }))
                            }
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">Qualification column</div>
                            <div className="text-xs text-slate-600">Use a column in the Excel to decide who qualifies.</div>

                            {rule.mode === 'column' ? (
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-700">Column</label>
                                  <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                                    value={rule.column}
                                    onChange={(e) =>
                                      setSlotRules((p) => ({
                                        ...p,
                                        [slot.id]: { ...rule, column: e.target.value },
                                      }))
                                    }
                                  >
                                    {headers.map((h) => (
                                      <option key={h} value={h}>
                                        {h}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="mb-1 block text-xs font-medium text-slate-700">Qualifies when value equals</label>
                                  <input
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                                    value={rule.value}
                                    onChange={(e) =>
                                      setSlotRules((p) => ({
                                        ...p,
                                        [slot.id]: { ...rule, value: e.target.value },
                                      }))
                                    }
                                    placeholder="YES"
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-600">No gift slots are configured for this issuing.</div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => setStep(importMode === 'table' ? 3 : 2)}
                disabled={importMutation.isPending}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                onClick={() => setStep(5)}
                disabled={importMode === 'giftSheets' ? !Object.values(sheetSlotMap).some(Boolean) : false}
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Preview and confirm</h2>
              <p className="text-sm text-slate-600">Review the import before committing changes.</p>
            </div>

            {importMode === 'table' ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">Resolved preview (first 10 rows)</div>
                <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Employee #</th>
                        <th className="px-4 py-3 font-semibold">First name</th>
                        <th className="px-4 py-3 font-semibold">Last name</th>
                        <th className="px-4 py-3 font-semibold">Qualifies for slots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resolvedPreview.map((r, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-900">{r.employee_number}</td>
                          <td className="px-4 py-3 text-slate-700">{r.first_name}</td>
                          <td className="px-4 py-3 text-slate-700">{r.last_name}</td>
                          <td className="px-4 py-3 text-slate-700">{r.slots.join(', ') || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                Gift sheets mapped: {Object.values(sheetSlotMap).filter(Boolean).length}
              </div>
            )}

            {importMutation.isError ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                Import failed. Please check your selections and permissions.
              </div>
            ) : null}

            {summary ? (
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Imported {summary.imported} employees. Skipped {summary.skippedDuplicatesInFile} duplicates in file and{' '}
                {summary.skippedDuplicatesExisting} duplicates already in the issuing. Skipped {summary.skippedMissingEmployeeNumber} rows missing employee number.
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => setStep(4)}
                disabled={importMutation.isPending}
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                className="flex items-center justify-center rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Import'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { profile, loading } = useAuth()

  if (loading) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">Overview and admin tools.</p>
        </div>

        {profile?.role === 'superadmin' ? (
          <ExcelImport />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
            No dashboard actions are configured for your role yet.
          </div>
        )}
      </div>
    </div>
  )
}


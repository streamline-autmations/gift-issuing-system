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

function TablePreview({
  headers,
  rows,
}: {
  headers: string[]
  rows: Record<string, unknown>[]
}) {
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

  useEffect(() => {
    setIssuingId('')
    setStep(1)
  }, [companyId])

  const [excel, setExcel] = useState<ParsedExcel | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    employee_number: '',
    first_name: null,
    last_name: null,
  })

  const [slotRules, setSlotRules] = useState<Record<string, SlotRule>>({})

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

  async function parseExcelFile(file: File) {
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = wb.SheetNames[0]
    const sheet = wb.Sheets[firstSheetName]
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]

    if (!raw.length) return { headers: [], rows: [] } as ParsedExcel

    const headerRow = raw[0] ?? []
    const headers = headerRow.map((h, i) => safeHeader(h, `Column ${i + 1}`))

    const rows = raw.slice(1).map((r) => {
      const obj: Record<string, unknown> = {}
      for (let i = 0; i < headers.length; i++) obj[headers[i]] = r?.[i] ?? ''
      return obj
    })

    return { headers, rows }
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    const name = file.name.toLowerCase()
    if (!(name.endsWith('.xlsx') || name.endsWith('.xls'))) {
      setExcel(null)
      return
    }

    parseExcelFile(file)
      .then((parsed) => {
        setExcel(parsed)
        setColumnMapping({ employee_number: '', first_name: null, last_name: null })
        setStep(3)
      })
      .catch(() => {
        setExcel(null)
      })
  }

  const headers = excel?.headers ?? []
  const rows = excel?.rows ?? []

  const canGoStep2 = Boolean(companyId && issuingId)
  const canGoStep3 = canGoStep2 && Boolean(excel)
  const canGoStep4 = canGoStep3 && Boolean(columnMapping.employee_number)

  const resolvedPreview = useMemo(() => {
    if (!excel) return [] as Array<{ employee_number: string; first_name: string; last_name: string; slots: string[] }>
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
        if (cell && expected && cell.toLowerCase() === expected.toLowerCase()) {
          slots.push(slotNameById.get(s.id) ?? s.id)
        }
      }
      return { employee_number, first_name, last_name, slots }
    })
  }, [excel, rows, giftSlotsQuery.data, slotRules, columnMapping])

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!excel) throw new Error('No file')
      if (!companyId || !issuingId) throw new Error('Select company and issuing')
      if (!columnMapping.employee_number) throw new Error('Map employee_number')

      const employeeCol = columnMapping.employee_number
      const firstCol = columnMapping.first_name
      const lastCol = columnMapping.last_name

      const mappedCols = new Set([employeeCol, firstCol ?? '', lastCol ?? ''].filter(Boolean))

      const seen = new Set<string>()
      const normalizedRows: Array<{ employee_number: string; first_name: string | null; last_name: string | null; extra_data: Record<string, unknown> }>
        = []
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

      const slotById = new Map((giftSlotsQuery.data ?? []).map((s) => [s.id, s]))
      const rowByEmployeeNumber = new Map(normalizedRows.map((r) => [r.employee_number.toLowerCase(), r]))

      const employeeSlotsRows: Array<{ id: string; employee_id: string; slot_id: string; company_id: string }> = []

      for (const emp of insertedEmployees) {
        const src = rowByEmployeeNumber.get(emp.employee_number.toLowerCase())
        if (!src) continue

        for (const [slotId, rule] of Object.entries(slotRules)) {
          const slot = slotById.get(slotId)
          if (!slot) continue

          let qualifies = false
          if (rule.mode === 'all') {
            qualifies = true
          } else {
            const cell = normalizeCell((excel.rows.find((r) => normalizeCell(r[employeeCol]).toLowerCase() === emp.employee_number.toLowerCase()) ?? {})[rule.column])
            const expected = normalizeCell(rule.value)
            qualifies = Boolean(cell && expected && cell.toLowerCase() === expected.toLowerCase())
          }

          if (!qualifies) continue
          employeeSlotsRows.push({
            id: crypto.randomUUID(),
            employee_id: emp.id,
            slot_id: slotId,
            company_id: companyId,
          })
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
              <p className="text-sm text-slate-600">Upload a .xlsx or .xls file. A preview will show before import.</p>
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

            {excel ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">Preview (first 5 rows)</div>
                <TablePreview headers={headers} rows={rows.slice(0, 5)} />
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
                onClick={() => setStep(3)}
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

            {!excel ? (
              <div className="text-sm text-slate-600">Upload a file first.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Employee number <span className="text-red-600">*</span>
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                    value={columnMapping.employee_number}
                    onChange={(e) =>
                      setColumnMapping((p) => ({ ...p, employee_number: e.target.value }))
                    }
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
                    onChange={(e) =>
                      setColumnMapping((p) => ({ ...p, first_name: e.target.value || null }))
                    }
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
                    onChange={(e) =>
                      setColumnMapping((p) => ({ ...p, last_name: e.target.value || null }))
                    }
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
              <p className="text-sm text-slate-600">Define how employees qualify for each slot.</p>
            </div>

            {giftSlotsQuery.isLoading ? (
              <div className="text-sm text-slate-600">Loading gift slots...</div>
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
                            <div className="text-xs text-slate-600">
                              Use a column in the Excel to decide who qualifies.
                            </div>

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
                onClick={() => setStep(3)}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={() => setStep(5)}
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

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-600">Employees found</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-600">Mapped columns</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {columnMapping.employee_number || 'employee_number (missing)'}
                </div>
                <div className="mt-1 text-xs text-slate-700">
                  {columnMapping.first_name ? `first_name → ${columnMapping.first_name}` : 'first_name → (not mapped)'}
                </div>
                <div className="mt-1 text-xs text-slate-700">
                  {columnMapping.last_name ? `last_name → ${columnMapping.last_name}` : 'last_name → (not mapped)'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold text-slate-600">Gift slots</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{(giftSlotsQuery.data ?? []).length}</div>
                <div className="mt-1 text-xs text-slate-700">Configured rules will be applied on import.</div>
              </div>
            </div>

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
                disabled={importMutation.isPending || !columnMapping.employee_number}
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

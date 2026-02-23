import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Employee, EmployeeSlot, GiftOption, IssuedRecord, IssuedSelection, Issuing } from '@/types'
import { printSlip } from '@/utils/printSlip'
import { AlertCircle, CheckCircle, History, Loader2, Search } from 'lucide-react'

type SlotView = {
  employeeSlot: EmployeeSlot
  fixedOption: GiftOption | null
  options: GiftOption[]
}

function employeeDisplayName(employee: Employee) {
  const first = (employee.first_name ?? '').trim()
  const last = (employee.last_name ?? '').trim()
  const full = `${first} ${last}`.trim()
  return full || 'Employee'
}

export default function Issue() {
  const { profile } = useAuth()

  const [issuings, setIssuings] = useState<Issuing[]>([])
  const [selectedIssuingId, setSelectedIssuingId] = useState(() => localStorage.getItem('activeIssuingId') || '')
  const [companyName, setCompanyName] = useState('')

  const [employeeNumber, setEmployeeNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [employeeSlots, setEmployeeSlots] = useState<EmployeeSlot[]>([])
  const [alreadyIssued, setAlreadyIssued] = useState<IssuedRecord | null>(null)
  const [issuedSelections, setIssuedSelections] = useState<IssuedSelection[]>([])
  const [issuedSelectionsLoading, setIssuedSelectionsLoading] = useState(false)
  const [issuedDetailsOpen, setIssuedDetailsOpen] = useState(false)

  const [history, setHistory] = useState<IssuedRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [choices, setChoices] = useState<Record<string, string>>({})

  const inputRef = useRef<HTMLInputElement>(null)

  const currentIssuing = useMemo(
    () => issuings.find((i) => i.id === selectedIssuingId) ?? null,
    [issuings, selectedIssuingId],
  )

  useEffect(() => {
    const companyId = profile?.company_id
    if (!companyId) return

    supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single()
      .then(({ data }) => {
        if (data?.name) setCompanyName(data.name)
      })
  }, [profile?.company_id])

  useEffect(() => {
    const companyId = profile?.company_id
    if (!companyId) return

    supabase
      .from('issuings')
      .select('id, company_id, name, mine_name, is_active, created_at')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) return
        const list = (data ?? []) as Issuing[]
        setIssuings(list)
        if (!selectedIssuingId && list[0]) setSelectedIssuingId(list[0].id)
      })
  }, [profile?.company_id, selectedIssuingId])

  useEffect(() => {
    if (!selectedIssuingId) return
    localStorage.setItem('activeIssuingId', selectedIssuingId)
  }, [selectedIssuingId])

  useEffect(() => {
    inputRef.current?.focus()
  }, [selectedIssuingId])

  const resetScreen = () => {
    setEmployee(null)
    setEmployeeSlots([])
    setAlreadyIssued(null)
    setIssuedSelections([])
    setIssuedSelectionsLoading(false)
    setIssuedDetailsOpen(false)
    setChecks({})
    setChoices({})
    setError(null)
    setEmployeeNumber('')
    setShowHistory(false)
    inputRef.current?.focus()
  }

  const loadIssuedSelections = async (issuedRecordId: string) => {
    setIssuedSelectionsLoading(true)
    const { data, error } = await supabase
      .from('issued_selections')
      .select(
        'id, issued_record_id, slot_id, gift_option_id, company_id, slot:gift_slots!issued_selections_slot_id_fkey(name, is_choice), gift_option:gift_options!issued_selections_gift_option_id_fkey(item_name)',
      )
      .eq('issued_record_id', issuedRecordId)

    setIssuedSelectionsLoading(false)
    if (error) return

    const normalized = (data ?? []).map((raw: any) => ({
      ...raw,
      slot: Array.isArray(raw.slot) ? raw.slot[0] : raw.slot,
      gift_option: Array.isArray(raw.gift_option) ? raw.gift_option[0] : raw.gift_option,
    })) as IssuedSelection[]

    setIssuedSelections(normalized)
  }

  const fetchHistory = async () => {
    if (!selectedIssuingId) return
    const { data } = await supabase
      .from('issued_records')
      .select('id, employee_id, issuing_id, company_id, issued_at, employee:employees!issued_records_employee_id_fkey(employee_number, first_name, last_name)')
      .eq('issuing_id', selectedIssuingId)
      .order('issued_at', { ascending: false })
      .limit(20)
    if (data) {
      const normalized = (data as any[]).map((r) => ({
        ...r,
        employee: Array.isArray(r.employee) ? r.employee[0] : r.employee,
      })) as IssuedRecord[]
      setHistory(normalized)
    }
  }

  useEffect(() => {
    if (!selectedIssuingId) return
    fetchHistory()
  }, [selectedIssuingId])

  useEffect(() => {
    if (!selectedIssuingId) return

    const channel = supabase
      .channel(`issued_records_${selectedIssuingId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'issued_records', filter: `issuing_id=eq.${selectedIssuingId}` },
        (payload) => {
          if (employee && payload.new.employee_id === employee.id) {
            lookupEmployee(employee.employee_number)
          }
          fetchHistory()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedIssuingId, employee])

  const slotViews = useMemo<SlotView[]>(() => {
    return employeeSlots.map((es) => {
      const options = es.slot.gift_options ?? []
      const fixedOption = es.slot.is_choice ? null : options[0] ?? null
      return { employeeSlot: es, fixedOption, options }
    })
  }, [employeeSlots])

  const fixedSlots = useMemo(() => slotViews.filter((sv) => !sv.employeeSlot.slot.is_choice), [slotViews])
  const choiceSlots = useMemo(() => slotViews.filter((sv) => sv.employeeSlot.slot.is_choice), [slotViews])

  const missingFixedOptions = useMemo(
    () => fixedSlots.some((sv) => !sv.fixedOption),
    [fixedSlots],
  )

  const canDistribute = useMemo(() => {
    if (!employee) return false
    if (alreadyIssued) return false
    if (!employeeSlots.length) return false
    if (missingFixedOptions) return false

    const fixedOk = fixedSlots.every((sv) => checks[sv.employeeSlot.slot.id] === true)
    const choiceOk = choiceSlots.every((sv) => Boolean(choices[sv.employeeSlot.slot.id]))
    return fixedOk && choiceOk
  }, [employee, alreadyIssued, employeeSlots, missingFixedOptions, fixedSlots, checks, choiceSlots, choices])

  const lookupEmployee = async (empNum: string = employeeNumber) => {
    if (!selectedIssuingId || !empNum.trim()) return

    setLoading(true)
    setError(null)
    setEmployee(null)
    setEmployeeSlots([])
    setAlreadyIssued(null)
    setIssuedSelections([])
    setIssuedSelectionsLoading(false)
    setIssuedDetailsOpen(false)
    setChecks({})
    setChoices({})
    setShowHistory(false)

    try {
      const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id, company_id, issuing_id, employee_number, first_name, last_name, extra_data')
        .eq('employee_number', empNum.trim())
        .eq('issuing_id', selectedIssuingId)
        .single()

      if (empError || !emp) {
        setError('Employee number not found in this issuing.')
        return
      }

      setEmployee(emp as Employee)

      const { data: issued } = await supabase
        .from('issued_records')
        .select('id, employee_id, issuing_id, company_id, issued_at')
        .eq('employee_id', emp.id)
        .eq('issuing_id', selectedIssuingId)
        .maybeSingle()

      if (issued) {
        setAlreadyIssued(issued as IssuedRecord)
        setShowHistory(true)
        return
      }

      const { data: slotRows, error: slotsError } = await supabase
        .from('employee_slots')
        .select('id, employee_id, slot_id, company_id, slot:gift_slots(id, name, is_choice, company_id, issuing_id, created_at, gift_options(id, slot_id, company_id, item_name, created_at))')
        .eq('employee_id', emp.id)

      if (slotsError) {
        setError('Failed to load employee gift slots.')
        return
      }

      const normalized = (slotRows ?? []).map((row: any) => ({
        id: row.id,
        employee_id: row.employee_id,
        slot_id: row.slot_id,
        company_id: row.company_id,
        slot: row.slot,
      })) as EmployeeSlot[]

      setEmployeeSlots(normalized)

      const fixedChecks: Record<string, boolean> = {}
      const choiceSelections: Record<string, string> = {}
      for (const es of normalized) {
        if (es.slot.is_choice) choiceSelections[es.slot.id] = ''
        else fixedChecks[es.slot.id] = false
      }
      setChecks(fixedChecks)
      setChoices(choiceSelections)

    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const distribute = async () => {
    if (!employee || !selectedIssuingId || !profile?.company_id) return
    if (!canDistribute) return

    setDistributing(true)
    setError(null)

    try {
      const issuedRecordId = crypto.randomUUID()
      const { data: record, error: recordError } = await supabase
        .from('issued_records')
        .insert({
          id: issuedRecordId,
          company_id: employee.company_id,
          issuing_id: selectedIssuingId,
          employee_id: employee.id,
        })
        .select('id, issued_at')
        .single()

      if (recordError || !record) throw recordError

      const selectionsToInsert: Array<Omit<IssuedSelection, 'gift_option' | 'slot'>> = []

      for (const sv of slotViews) {
        const slot = sv.employeeSlot.slot
        const slotId = slot.id

        let optionId = ''
        if (slot.is_choice) {
          optionId = choices[slotId]
        } else {
          optionId = sv.fixedOption?.id ?? ''
        }

        if (!optionId) throw new Error('Missing gift selection')

        selectionsToInsert.push({
          id: crypto.randomUUID(),
          issued_record_id: issuedRecordId,
          slot_id: slotId,
          gift_option_id: optionId,
          company_id: employee.company_id,
        })
      }

      const { error: selectionsError } = await supabase.from('issued_selections').insert(selectionsToInsert)
      if (selectionsError) throw selectionsError

      const optionNameById = new Map<string, string>()
      for (const sv of slotViews) {
        for (const opt of sv.options) optionNameById.set(opt.id, opt.item_name)
      }

      const printItems = slotViews.map((sv) => {
        const slot = sv.employeeSlot.slot
        const selectedOptionId = slot.is_choice ? choices[slot.id] : sv.fixedOption?.id
        const itemName = selectedOptionId ? optionNameById.get(selectedOptionId) ?? '' : ''
        return { slotName: slot.name, itemName, isChoice: slot.is_choice }
      })

      printSlip({
        companyName: companyName || 'Company',
        issuingName: currentIssuing?.name || '',
        mineName: currentIssuing?.mine_name || '',
        issuedAt: record.issued_at,
        employee,
        items: printItems,
      })

      resetScreen()
      fetchHistory()
    } catch {
      setError('Failed to distribute. Please try again.')
    } finally {
      setDistributing(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-sm font-medium text-gray-600">Active Issuing:</label>
          <select
            value={selectedIssuingId}
            onChange={(e) => {
              setSelectedIssuingId(e.target.value)
              resetScreen()
            }}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-slate-900 outline-none min-w-[240px]"
          >
            <option value="" disabled>
              Select issuing...
            </option>
            {issuings.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.mine_name})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') lookupEmployee()
              }}
              placeholder="Enter Employee Number"
              className="w-full text-2xl px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 outline-none transition-all"
              disabled={loading}
            />
            {loading ? (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900" />
              </div>
            ) : null}
          </div>
          <button
            onClick={() => lookupEmployee()}
            disabled={loading || !employeeNumber.trim() || !selectedIssuingId}
            className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg"
          >
            <Search size={24} />
            Lookup
          </button>
        </div>

        {error ? (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        ) : null}

        {missingFixedOptions && employee ? (
          <div className="mt-4 p-4 bg-orange-50 text-orange-800 rounded-lg border border-orange-200">
            One or more fixed slots have no gift option configured. Add an option under Admin → Gifts.
          </div>
        ) : null}
      </div>

      <div className="flex gap-6 items-start">
        <div className="flex-1">
          {alreadyIssued ? (
            <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 text-orange-600 rounded-full mb-4">
                <CheckCircle size={40} />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{employee ? employeeDisplayName(employee) : ''}</h2>
              <p className="text-gray-500 text-lg mb-6">#{employee?.employee_number}</p>
              <div className="inline-block px-6 py-2 bg-orange-100 text-orange-800 font-bold rounded-full text-lg mb-4">
                ALREADY ISSUED
              </div>
              <p className="text-gray-600">Issued on {new Date(alreadyIssued.issued_at).toLocaleString()}</p>

              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  onClick={async () => {
                    const nextOpen = !issuedDetailsOpen
                    setIssuedDetailsOpen(nextOpen)
                    if (nextOpen && issuedSelections.length === 0) {
                      await loadIssuedSelections(alreadyIssued.id)
                    }
                  }}
                >
                  {issuedDetailsOpen ? 'Hide details' : 'View history details'}
                </button>
              </div>

              {issuedDetailsOpen ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                  <div className="text-sm font-semibold text-slate-900">Collected items</div>
                  {issuedSelectionsLoading ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : issuedSelections.length ? (
                    <div className="mt-3 space-y-2">
                      {issuedSelections.map((s) => (
                        <div key={s.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                          <div className="text-sm font-medium text-slate-900">{s.slot?.name ?? 'Slot'}</div>
                          <div className="text-sm text-slate-700">{s.gift_option?.item_name ?? ''}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-slate-600">No selection details found.</div>
                  )}
                </div>
              ) : null}
            </div>
          ) : employee ? (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{employeeDisplayName(employee)}</h2>
                  <p className="text-slate-700 font-medium">#{employee.employee_number}</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                  Ready
                </span>
              </div>

              {fixedSlots.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-700">1. To Process</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {fixedSlots.map((sv) => (
                      <div
                        key={sv.employeeSlot.slot.id}
                        className="flex items-center p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <label className="flex items-center gap-4 cursor-pointer w-full">
                          <input
                            type="checkbox"
                            checked={checks[sv.employeeSlot.slot.id] === true}
                            onChange={(e) =>
                              setChecks((p) => ({ ...p, [sv.employeeSlot.slot.id]: e.target.checked }))
                            }
                            className="w-6 h-6 text-slate-900 rounded border-gray-300 focus:ring-slate-900"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{sv.employeeSlot.slot.name}</p>
                            <p className="text-sm text-gray-500">{sv.fixedOption?.item_name ?? ''}</p>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {choiceSlots.length > 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-700">2. Combo's</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    {choiceSlots.map((sv) => (
                      <div key={sv.employeeSlot.slot.id}>
                        <p className="font-medium text-gray-900 mb-3">{sv.employeeSlot.slot.name}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(sv.options ?? []).map((opt) => (
                            <label
                              key={opt.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                choices[sv.employeeSlot.slot.id] === opt.id
                                  ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`slot-${sv.employeeSlot.slot.id}`}
                                value={opt.id}
                                checked={choices[sv.employeeSlot.slot.id] === opt.id}
                                onChange={(e) =>
                                  setChoices((p) => ({ ...p, [sv.employeeSlot.slot.id]: e.target.value }))
                                }
                                className="w-5 h-5 text-slate-900 border-gray-300 focus:ring-slate-900"
                              />
                              <span className="text-gray-700">{opt.item_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-4 pt-2">
                <button
                  onClick={resetScreen}
                  className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors flex-1"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={distribute}
                  disabled={!canDistribute || distributing}
                  className="px-6 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg rounded-xl shadow-lg transition-all transform active:scale-[0.98] flex-[2] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  type="button"
                >
                  {distributing ? 'Processing...' : 'Distribute'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Search size={48} className="mb-4 opacity-50" />
              <p className="text-xl font-medium">Enter an employee number to begin</p>
            </div>
          )}
        </div>

        <div className="w-80 flex flex-col gap-4">
          <div className="flex bg-white rounded-lg shadow-sm p-1 border border-gray-200">
            <button
              onClick={() => setShowHistory(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !showHistory ? 'bg-slate-50 text-slate-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              type="button"
            >
              Process Item
            </button>
            <button
              onClick={() => {
                setShowHistory(true)
                fetchHistory()
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                showHistory ? 'bg-slate-50 text-slate-900' : 'text-gray-500 hover:text-gray-700'
              }`}
              type="button"
            >
              History
            </button>
          </div>

          {showHistory ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 max-h-[calc(100vh-250px)] overflow-y-auto">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <History size={16} />
                  Last 20 Issued
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {history.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">No history yet</div>
                ) : (
                  history.map((r) => (
                    <div key={r.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-gray-900">#{r.employee?.employee_number}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(r.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {r.employee ? `${(r.employee.first_name ?? '').trim()} ${(r.employee.last_name ?? '').trim()}`.trim() : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

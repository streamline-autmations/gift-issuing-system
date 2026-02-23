import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Employee, EmployeeSlot, GiftSlot, IssuedRecord, IssuedSelection, Issuing } from '@/types'
import { Download, Users, CheckCircle, Clock, BarChart3, Search, Filter } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function Reports() {
  const { profile } = useAuth()
  
  // Selection State
  const [companies, setCompanies] = useState<{ id: string, name: string }[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [issuings, setIssuings] = useState<Issuing[]>([])
  const [selectedIssuingId, setSelectedIssuingId] = useState<string>('')

  // Data State
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [issuedRecords, setIssuedRecords] = useState<Record<string, IssuedRecord>>({})
  const [issuedSelections, setIssuedSelections] = useState<Record<string, IssuedSelection[]>>({}) // key: issued_record_id
  const [slots, setSlots] = useState<GiftSlot[]>([])
  const [employeeSlots, setEmployeeSlots] = useState<EmployeeSlot[]>([])

  // UI State
  const [activeTab, setActiveTab] = useState<'outstanding' | 'collected' | 'full'>('outstanding')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'issued' | 'pending'>('all')

  const getEmployeeName = (e: Employee) => {
    const first = (e.first_name ?? '').trim()
    const last = (e.last_name ?? '').trim()
    return `${first} ${last}`.trim()
  }

  // 1. Load Companies (Superadmin) or Set Default
  useEffect(() => {
    if (!profile) return

    if (profile.role === 'superadmin') {
      supabase.from('companies').select('id, name').order('name').then(({ data }) => {
        if (data) {
          setCompanies(data)
          if (data.length > 0) setSelectedCompanyId(data[0].id)
        }
      })
    } else if (profile.company_id) {
      setSelectedCompanyId(profile.company_id)
    }
  }, [profile])

  // 2. Load Issuings when Company Selected
  useEffect(() => {
    if (!selectedCompanyId) return
    
    setIssuings([])
    setSelectedIssuingId('')
    
    supabase
      .from('issuings')
      .select('*')
      .eq('company_id', selectedCompanyId)
      .order('created_at', { ascending: false }) // Newest first
      .then(({ data }) => {
        if (data) {
          setIssuings(data)
          // Optional: Auto-select most recent active?
          // For now let user select.
        }
      })
  }, [selectedCompanyId])

  // 3. Load Report Data when Issuing Selected
  useEffect(() => {
    if (!selectedIssuingId) return

    setLoading(true)
    
    async function loadData() {
      try {
        const fetchAll = async <T,>(
          fetchPage: (from: number, to: number) => any,
          pageSize = 1000,
        ) => {
          let from = 0
          const out: T[] = []
          while (true) {
            const to = from + pageSize - 1
            const { data, error } = await (fetchPage(from, to) as any)
            if (error) throw error
            const page = (data ?? []) as T[]
            out.push(...page)
            if (page.length < pageSize) break
            from += pageSize
          }
          return out
        }

        // Fetch all Employees
        const allEmployees = await fetchAll<Employee>((from, to) =>
          supabase
            .from('employees')
            .select('id, company_id, issuing_id, employee_number, first_name, last_name, extra_data')
            .eq('issuing_id', selectedIssuingId)
            .order('employee_number', { ascending: true })
            .range(from, to),
        )
        
        setEmployees(allEmployees)

        // Fetch all Issued Records
        const recordData = await fetchAll<IssuedRecord>((from, to) =>
          supabase
            .from('issued_records')
            .select('id, company_id, issuing_id, employee_id, issued_at')
            .eq('issuing_id', selectedIssuingId)
            .order('issued_at', { ascending: true })
            .range(from, to),
        )
        
        const recordsMap: Record<string, IssuedRecord> = {}
        const recordIds: string[] = []
        recordData.forEach(r => {
          recordsMap[r.employee_id] = r
          recordIds.push(r.id)
        })
        setIssuedRecords(recordsMap)

        // Fetch all Selections (if any records exist)
        const selectionsMap: Record<string, IssuedSelection[]> = {}
        const allSelections = await fetchAll<any>((from, to) =>
          supabase
            .from('issued_selections')
            .select(
              'id, issued_record_id, slot_id, gift_option_id, company_id, issued_record:issued_records!issued_selections_issued_record_id_fkey(issuing_id), slot:gift_slots!issued_selections_slot_id_fkey(name, is_choice), gift_option:gift_options!issued_selections_gift_option_id_fkey(item_name)',
            )
            .eq('issued_record.issuing_id', selectedIssuingId)
            .order('id', { ascending: true })
            .range(from, to),
        )

        allSelections.forEach((raw: any) => {
          const normalized: IssuedSelection = {
            id: raw.id,
            issued_record_id: raw.issued_record_id,
            slot_id: raw.slot_id,
            gift_option_id: raw.gift_option_id,
            company_id: raw.company_id,
            slot: Array.isArray(raw.slot) ? raw.slot[0] : raw.slot,
            gift_option: Array.isArray(raw.gift_option) ? raw.gift_option[0] : raw.gift_option,
          }
          if (!selectionsMap[normalized.issued_record_id]) selectionsMap[normalized.issued_record_id] = []
          selectionsMap[normalized.issued_record_id].push(normalized)
        })
        setIssuedSelections(selectionsMap)

        // Fetch Slots and Employee Allocations (for Totals breakdown)
        // We need slots to know names
        // We need employee_slots to know who qualified for what
        
        // Fetch Slots for this issuing (via company or just assuming slots are global/company based?
        // Schema check: slots usually don't have issuing_id directly unless linked. 
        // Usually slots are linked to employees via employee_slots.
        // Let's fetch employee_slots for all employees in this issuing.
        
        const empSlotsData = await fetchAll<any>((from, to) =>
          supabase
            .from('employee_slots')
            .select('id, employee_id, slot_id, company_id, slot:gift_slots(id, issuing_id, company_id, name, is_choice, created_at)')
            .eq('slot.issuing_id', selectedIssuingId)
            .order('id', { ascending: true })
            .range(from, to),
        )

        const normalizedEmployeeSlots = (empSlotsData as any[]).map((row) => ({
          id: row.id,
          employee_id: row.employee_id,
          slot_id: row.slot_id,
          company_id: row.company_id,
          slot: Array.isArray(row.slot) ? row.slot[0] : row.slot,
        })) as EmployeeSlot[]

        setEmployeeSlots(normalizedEmployeeSlots)
        
        const uniqueSlots = new Map<string, GiftSlot>()
        normalizedEmployeeSlots.forEach((es: any) => {
            if (es.slot) uniqueSlots.set(es.slot.id, es.slot)
        })
        setSlots(Array.from(uniqueSlots.values()))

      } catch (err) {
        console.error('Error loading report data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedIssuingId])

  // --- Processing ---

  // Report 1: Totals
  const totals = useMemo(() => {
    const totalInIssuing = employees.length
    const totalIssued = Object.keys(issuedRecords).length
    const totalOutstanding = totalInIssuing - totalIssued
    const percentComplete = totalInIssuing > 0 ? Math.round((totalIssued / totalInIssuing) * 100) : 0

    // Slot Breakdown
    const slotStats = slots.map(slot => {
      const qualified = employeeSlots.filter(es => es.slot_id === slot.id)
      const totalQualified = qualified.length
      
      // Count issued
      let totalIssuedSlot = 0
      qualified.forEach(es => {
        if (issuedRecords[es.employee_id]) {
           totalIssuedSlot++
        }
      })

      return {
        id: slot.id,
        name: slot.name,
        totalQualified,
        totalIssued: totalIssuedSlot,
        totalOutstanding: totalQualified - totalIssuedSlot
      }
    })

    return { totalInIssuing, totalIssued, totalOutstanding, percentComplete, slotStats }
  }, [employees, issuedRecords, slots, employeeSlots])

  // Filtered Data for Tables
  const filteredData = useMemo(() => {
    let data = employees

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      data = data.filter(e => 
        e.employee_number.toLowerCase().includes(q) || 
        getEmployeeName(e).toLowerCase().includes(q)
      )
    }

    // Status Filter (for Full Data tab)
    if (filterStatus !== 'all') {
      data = data.filter(e => {
        const isIssued = !!issuedRecords[e.id]
        return filterStatus === 'issued' ? isIssued : !isIssued
      })
    }
    
    return data
  }, [employees, searchQuery, filterStatus, issuedRecords])

  // Helper to format extra data
  const formatExtraData = (data?: Record<string, any>) => {
    if (!data) return ''
    return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(', ')
  }

  // Helper to get items received string
  const getItemsReceived = (empId: string) => {
    const record = issuedRecords[empId]
    if (!record) return ''
    const sels = issuedSelections[record.id] || []
    return sels
      .map((s) => {
        const slotName = s.slot?.name ?? ''
        const item = s.gift_option?.item_name ?? ''
        if (slotName && item) return `${slotName}: ${item}`
        return item || slotName
      })
      .filter(Boolean)
      .join(', ')
  }

  // --- Export ---
  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    const issuingName = issuings.find(i => i.id === selectedIssuingId)?.name || 'Issuing'
    const dateStr = new Date().toISOString().split('T')[0]

    const allExtraKeys = Array.from(
      new Set(
        employees.flatMap((e) => Object.keys((e.extra_data ?? {}) as Record<string, any>)),
      ),
    ).sort()

    const fileSafeIssuing = issuingName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')

    // 1. Totals Sheet
    const totalsData = [
      ['Metric', 'Value'],
      ['Total in Issuing', totals.totalInIssuing],
      ['Total Issued', totals.totalIssued],
      ['Total Outstanding', totals.totalOutstanding],
      ['Percent Complete', `${totals.percentComplete}%`],
      [],
      ['Slot Breakdown'],
      ['Slot Name', 'Total Qualified', 'Total Issued', 'Total Outstanding'],
      ...totals.slotStats.map(s => [s.name, s.totalQualified, s.totalIssued, s.totalOutstanding])
    ]
    const wsTotals = XLSX.utils.aoa_to_sheet(totalsData)
    XLSX.utils.book_append_sheet(wb, wsTotals, 'Totals')

    // 2. Outstanding Sheet
    const outstandingRows = employees
      .filter(e => !issuedRecords[e.id])
      .map(e => ({
        'Employee Number': e.employee_number,
        'First Name': e.first_name ?? '',
        'Last Name': e.last_name ?? '',
        ...allExtraKeys.reduce((acc, k) => {
          ;(acc as any)[k] = (e.extra_data as any)?.[k] ?? ''
          return acc
        }, {} as Record<string, any>),
      }))
    const wsOutstanding = XLSX.utils.json_to_sheet(outstandingRows)
    XLSX.utils.book_append_sheet(wb, wsOutstanding, 'Outstanding')

    // 3. Collected Sheet
    const collectedRows = employees
      .filter(e => issuedRecords[e.id])
      .map(e => {
        const record = issuedRecords[e.id]
        return {
          'Employee Number': e.employee_number,
          'First Name': e.first_name ?? '',
          'Last Name': e.last_name ?? '',
          'Date Collected': new Date(record.issued_at).toLocaleString(),
          'Items Received': getItemsReceived(e.id),
          ...allExtraKeys.reduce((acc, k) => {
            ;(acc as any)[k] = (e.extra_data as any)?.[k] ?? ''
            return acc
          }, {} as Record<string, any>),
        }
      })
    const wsCollected = XLSX.utils.json_to_sheet(collectedRows)
    XLSX.utils.book_append_sheet(wb, wsCollected, 'Collected')

    // 4. Full Data Sheet
    const fullRows = employees.map(e => {
        const record = issuedRecords[e.id]
        return {
          'Employee Number': e.employee_number,
          'First Name': e.first_name ?? '',
          'Last Name': e.last_name ?? '',
          'Status': record ? 'Issued' : 'Pending',
          'Date Collected': record ? new Date(record.issued_at).toLocaleString() : '',
          'Items Received': getItemsReceived(e.id),
          ...allExtraKeys.reduce((acc, k) => {
            ;(acc as any)[k] = (e.extra_data as any)?.[k] ?? ''
            return acc
          }, {} as Record<string, any>),
        }
    })
    const wsFull = XLSX.utils.json_to_sheet(fullRows)
    XLSX.utils.book_append_sheet(wb, wsFull, 'Full Data')

    // Save
    XLSX.writeFile(wb, `${fileSafeIssuing}_${dateStr}.xlsx`)
  }

  // --- Render ---

  if (!profile) return null

  return (
    <div className="space-y-6">
      
      {/* Top Filter Bar */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          {profile.role === 'superadmin' && (
            <select 
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-slate-900 outline-none min-w-[200px]"
            >
              <option value="" disabled>Select Company...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          
          <select 
            value={selectedIssuingId}
            onChange={(e) => setSelectedIssuingId(e.target.value)}
            disabled={!selectedCompanyId}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-slate-900 outline-none min-w-[200px]"
          >
            <option value="">Select Issuing...</option>
            {issuings.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>

        {selectedIssuingId && (
           <button 
             onClick={handleExport}
             className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
           >
             <Download size={18} />
             Export to Excel
           </button>
        )}
      </div>

      {!selectedIssuingId ? (
        <div className="text-center py-20 text-gray-500">
          <BarChart3 size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg">Select an issuing to view reports</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
        </div>
      ) : (
        <>
          {/* Report 1: Totals Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total in Issuing</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-2">{totals.totalInIssuing}</h3>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Users size={20} />
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Issued</p>
                  <h3 className="text-3xl font-bold text-green-600 mt-2">{totals.totalIssued}</h3>
                </div>
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  <CheckCircle size={20} />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Outstanding</p>
                  <h3 className="text-3xl font-bold text-orange-600 mt-2">{totals.totalOutstanding}</h3>
                </div>
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                  <Clock size={20} />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <p className="text-sm font-medium text-gray-500 mb-4">Completion Progress</p>
              <div className="flex items-end gap-2 mb-2">
                <h3 className="text-3xl font-bold text-slate-900">{totals.percentComplete}%</h3>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-slate-900 h-2.5 rounded-full" style={{ width: `${totals.percentComplete}%` }}></div>
              </div>
            </div>
          </div>

          {/* Slot Breakdown */}
          {totals.slotStats.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Slot Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-sm">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Gift Slot</th>
                      <th className="px-4 py-3">Qualified</th>
                      <th className="px-4 py-3">Issued</th>
                      <th className="px-4 py-3 rounded-r-lg">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {totals.slotStats.map(stat => (
                      <tr key={stat.id}>
                        <td className="px-4 py-3 font-medium text-gray-900">{stat.name}</td>
                        <td className="px-4 py-3 text-gray-600">{stat.totalQualified}</td>
                        <td className="px-4 py-3 text-green-600 font-medium">{stat.totalIssued}</td>
                        <td className="px-4 py-3 text-orange-600 font-medium">{stat.totalOutstanding}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detailed Reports Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 flex flex-wrap">
              <button
                onClick={() => setActiveTab('outstanding')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'outstanding' 
                    ? 'border-orange-500 text-orange-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Outstanding (To Redeem)
              </button>
              <button
                onClick={() => setActiveTab('collected')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'collected' 
                    ? 'border-green-500 text-green-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Collected (Redeemed)
              </button>
              <button
                onClick={() => setActiveTab('full')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'full' 
                    ? 'border-slate-900 text-slate-900' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Full Data
              </button>
            </div>

            <div className="p-6">
              {/* Toolbar */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none"
                  />
                </div>
                
                <div className="flex items-center gap-4">
                   {activeTab === 'full' && (
                     <div className="flex items-center gap-2">
                       <Filter size={18} className="text-gray-400" />
                       <select
                         value={filterStatus}
                         onChange={(e) => setFilterStatus(e.target.value as any)}
                         className="border border-gray-300 rounded-md px-3 py-2 text-sm outline-none"
                       >
                         <option value="all">All Status</option>
                         <option value="issued">Issued</option>
                         <option value="pending">Pending</option>
                       </select>
                     </div>
                   )}
                   <span className="text-sm font-medium text-gray-500">
                     Total: {filteredData.length}
                   </span>
                </div>
              </div>

              {/* Tables */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-600 text-sm">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">Employee #</th>
                      <th className="px-4 py-3">Name</th>
                      {activeTab !== 'outstanding' && <th className="px-4 py-3">Collected At</th>}
                      {activeTab !== 'outstanding' && <th className="px-4 py-3">Items Received</th>}
                      {activeTab === 'full' && <th className="px-4 py-3">Status</th>}
                      <th className="px-4 py-3 rounded-r-lg">Extra Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredData.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No records found matching your filters.</td>
                        </tr>
                    ) : (
                        filteredData
                        .filter(e => {
                             if (activeTab === 'outstanding') return !issuedRecords[e.id]
                             if (activeTab === 'collected') return issuedRecords[e.id]
                             return true
                        })
                        .slice(0, 100) // Limit render for perf
                        .map(e => {
                          const record = issuedRecords[e.id]
                          return (
                            <tr key={e.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{e.employee_number}</td>
                              <td className="px-4 py-3 text-gray-800">{getEmployeeName(e)}</td>
                              
                              {activeTab !== 'outstanding' && (
                                <td className="px-4 py-3 text-gray-600 text-sm">
                                  {record ? new Date(record.issued_at).toLocaleString() : '-'}
                                </td>
                              )}
                              
                              {activeTab !== 'outstanding' && (
                                <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate" title={getItemsReceived(e.id)}>
                                  {getItemsReceived(e.id) || '-'}
                                </td>
                              )}

                              {activeTab === 'full' && (
                                <td className="px-4 py-3">
                                  {record ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Issued
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                      Pending
                                    </span>
                                  )}
                                </td>
                              )}

                              <td className="px-4 py-3 text-gray-500 text-sm">
                                {formatExtraData(e.extra_data)}
                              </td>
                            </tr>
                          )
                        })
                    )}
                    {filteredData.length > 100 && (
                        <tr>
                            <td colSpan={6} className="px-4 py-4 text-center text-gray-400 text-sm">
                                Showing first 100 records. Export to see all.
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

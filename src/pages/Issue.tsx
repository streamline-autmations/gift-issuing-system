import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Issuing, Employee, IssuedRecord, EmployeeSlot } from '../types'
import { Search, RefreshCw, History, AlertCircle, CheckCircle } from 'lucide-react'

export default function Issue() {
  const { profile } = useAuth()
  
  // State
  const [issuings, setIssuings] = useState<Issuing[]>([])
  const [selectedIssuingId, setSelectedIssuingId] = useState<string>(() => localStorage.getItem('activeIssuingId') || '')
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Lookup State
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [employeeSlots, setEmployeeSlots] = useState<EmployeeSlot[]>([])
  const [alreadyIssued, setAlreadyIssued] = useState<IssuedRecord | null>(null)
  
  // Selections State
  const [selections, setSelections] = useState<Record<string, string | boolean>>({})
  
  // History State
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<IssuedRecord[]>([])

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load Issuings
  useEffect(() => {
    const companyId = profile?.company_id
    if (!companyId) return

    async function loadIssuings() {
      const { data, error } = await supabase
        .from('issuings')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
      
      if (error) {
        console.error('Error loading issuings:', error)
        return
      }

      setIssuings(data || [])
      
      // If selected issuing is not in the list (or empty), select the first one
      if (data && data.length > 0) {
        const current = data.find(i => i.id === selectedIssuingId)
        if (!current) {
          setSelectedIssuingId(data[0].id)
        }
      }
    }

    loadIssuings()
  }, [profile?.company_id])

  // Persist selected issuing
  useEffect(() => {
    if (selectedIssuingId) {
      localStorage.setItem('activeIssuingId', selectedIssuingId)
    }
  }, [selectedIssuingId])

  // Real-time subscription for history/updates
  useEffect(() => {
    if (!selectedIssuingId) return

    const channel = supabase
      .channel('issued_records_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'issued_records',
          filter: `issuing_id=eq.${selectedIssuingId}`,
        },
        (payload) => {
          // If we are currently looking at this employee, update UI
          if (employee && payload.new.employee_id === employee.id) {
             // Re-trigger lookup to update status to "Already Issued"
             handleLookup(employee.employee_number)
          }
          // Update history
          fetchHistory()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedIssuingId, employee])

  // Fetch History
  const fetchHistory = async () => {
    if (!selectedIssuingId) return
    
    const { data, error } = await supabase
      .from('issued_records')
      .select('*, employee:employees(employee_number, name)')
      .eq('issuing_id', selectedIssuingId)
      .order('issued_at', { ascending: false })
      .limit(20)
      
    if (!error && data) {
      setHistory(data)
    }
  }
  
  // Initial history load
  useEffect(() => {
    if (selectedIssuingId) fetchHistory()
  }, [selectedIssuingId])

  // Focus input on load and reset
  useEffect(() => {
    searchInputRef.current?.focus()
  }, [selectedIssuingId, employee])

  const resetState = () => {
    setEmployee(null)
    setEmployeeSlots([])
    setAlreadyIssued(null)
    setSelections({})
    setError(null)
    setEmployeeNumber('')
    searchInputRef.current?.focus()
  }

  const handleLookup = async (empNum: string = employeeNumber) => {
    if (!selectedIssuingId || !empNum.trim()) return

    setLoading(true)
    setError(null)
    setEmployee(null)
    setAlreadyIssued(null)
    setEmployeeSlots([])
    setSelections({})
    setShowHistory(false)

    try {
      // 1. Find Employee
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_number', empNum)
        .eq('issuing_id', selectedIssuingId)
        .single()

      if (empError || !empData) {
        setError('Employee number not found in this issuing.')
        setLoading(false)
        return
      }

      setEmployee(empData)

      // 2. Check if already issued
      const { data: issuedData } = await supabase
        .from('issued_records')
        .select('*')
        .eq('employee_id', empData.id)
        .eq('issuing_id', selectedIssuingId)
        .maybeSingle()

      if (issuedData) {
        setAlreadyIssued(issuedData)
        setShowHistory(true)
        setLoading(false)
        return
      }

      // 3. Fetch Slots
      // Assuming a table structure where we can get slots for an employee
      // This might need adjustment based on actual schema. 
      // Strategy: Get all slots for issuing, then filter or join if there's specific allocation.
      // For now, assuming a direct `employee_slots` table or `slots` table query.
      
      // Let's assume we fetch all slots for the issuing first (or specific to employee if schema supports)
      // If there is an `employee_slots` table:
      const { data: slotsData, error: slotsError } = await supabase
        .from('employee_slots')
        .select(`
          id,
          slot:slots (
            id,
            name,
            is_choice,
            is_bonus,
            item_name,
            options:slot_options(name)
          )
        `)
        .eq('employee_id', empData.id)

      if (slotsError) {
        console.error('Error fetching slots:', slotsError)
        setError('Failed to load employee slots.')
      } else {
        // Transform data to match our interface
        const formattedSlots: EmployeeSlot[] = slotsData.map((item: any) => ({
          id: item.id,
          employee_id: item.employee_id,
          slot_id: item.slot.id,
          slot: {
            id: item.slot.id,
            name: item.slot.name,
            is_choice: item.slot.is_choice,
            is_bonus: item.slot.is_bonus,
            item_name: item.slot.item_name,
            options: item.slot.options?.map((o: any) => o.name) || []
          }
        }))
        setEmployeeSlots(formattedSlots)
      }

    } catch (err) {
      console.error(err)
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectionChange = (slotId: string, value: string | boolean) => {
    setSelections(prev => ({
      ...prev,
      [slotId]: value
    }))
  }

  const isReadyToDistribute = () => {
    if (!employeeSlots.length) return false
    
    return employeeSlots.every(es => {
      const selection = selections[es.slot.id]
      if (es.slot.is_choice) {
        return typeof selection === 'string' && selection.length > 0
      } else {
        return selection === true
      }
    })
  }

  const handleDistribute = async () => {
    if (!employee || !selectedIssuingId || !isReadyToDistribute()) return
    
    setDistributing(true)
    
    try {
      // 1. Create Issued Record
      const { data: record, error: recordError } = await supabase
        .from('issued_records')
        .insert({
          employee_id: employee.id,
          issuing_id: selectedIssuingId,
          operator_id: profile?.id,
          issued_at: new Date().toISOString()
        })
        .select()
        .single()

      if (recordError || !record) throw recordError

      // 2. Create Selections
      const selectionsData = employeeSlots.map(es => {
        const val = selections[es.slot.id]
        let itemName = ''
        if (es.slot.is_choice) {
          itemName = val as string
        } else {
          itemName = es.slot.item_name || es.slot.name
        }

        return {
          issued_record_id: record.id,
          slot_id: es.slot.id,
          item_name: itemName
        }
      })

      const { error: selectionsError } = await supabase
        .from('issued_selections')
        .insert(selectionsData)

      if (selectionsError) throw selectionsError

      // 3. Trigger Print (Placeholder)
      // window.print() or open modal
      alert(`Issued successfully to ${employee.name}! Printing slip...`)

      // 4. Reset
      resetState()
      fetchHistory() // Refresh history immediately

    } catch (err) {
      console.error('Distribute error:', err)
      setError('Failed to distribute items. Please try again.')
    } finally {
      setDistributing(false)
    }
  }

  // Group slots by type
  const toProcessSlots = employeeSlots.filter(s => !s.slot.is_choice && !s.slot.is_bonus)
  const comboSlots = employeeSlots.filter(s => s.slot.is_choice && !s.slot.is_bonus)
  const stockSlots = employeeSlots.filter(s => s.slot.is_bonus)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span className="p-2 bg-blue-600 rounded-lg text-white"><RefreshCw size={20} /></span>
          Mining Distribution
        </h1>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-600">Active Issuing:</label>
          <select 
            value={selectedIssuingId}
            onChange={(e) => setSelectedIssuingId(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="" disabled>Select Issuing...</option>
            {issuings.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* Lookup Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="Enter Employee Number"
                className="w-full text-2xl px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                disabled={loading}
              />
              {loading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
            <button
              onClick={() => handleLookup()}
              disabled={loading || !employeeNumber.trim()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg"
            >
              <Search size={24} />
              Lookup
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex gap-6 items-start">
          
          {/* Left Panel: Process / Result */}
          <div className="flex-1">
            
            {alreadyIssued ? (
              <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 text-orange-600 rounded-full mb-4">
                  <CheckCircle size={40} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">{employee?.name}</h2>
                <p className="text-gray-500 text-lg mb-6">#{employee?.employee_number}</p>
                
                <div className="inline-block px-6 py-2 bg-orange-100 text-orange-800 font-bold rounded-full text-lg mb-4">
                  ALREADY ISSUED
                </div>
                <p className="text-gray-600">
                  Issued on {new Date(alreadyIssued.issued_at).toLocaleString()}
                </p>
              </div>
            ) : employee ? (
              <div className="space-y-6">
                
                {/* Employee Header */}
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{employee.name}</h2>
                    <p className="text-blue-700 font-medium">#{employee.employee_number}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      Ready to Process
                    </span>
                  </div>
                </div>

                {/* Section 1: To Process (Fixed) */}
                {toProcessSlots.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-700">1. To Process</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      {toProcessSlots.map(es => (
                        <div key={es.slot.id} className="flex items-center p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                          <label className="flex items-center gap-4 cursor-pointer w-full">
                            <input
                              type="checkbox"
                              checked={!!selections[es.slot.id]}
                              onChange={(e) => handleSelectionChange(es.slot.id, e.target.checked)}
                              className="w-6 h-6 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{es.slot.name}</p>
                              <p className="text-sm text-gray-500">{es.slot.item_name}</p>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 2: Combos (Choice) */}
                {comboSlots.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-700">2. Combo's</h3>
                    </div>
                    <div className="p-6 space-y-6">
                      {comboSlots.map(es => (
                        <div key={es.slot.id}>
                          <p className="font-medium text-gray-900 mb-3">{es.slot.name}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {es.slot.options?.map((option) => (
                              <label key={option} className={`
                                flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                                ${selections[es.slot.id] === option 
                                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
                                  : 'border-gray-200 hover:border-gray-300'}
                              `}>
                                <input
                                  type="radio"
                                  name={`slot-${es.slot.id}`}
                                  value={option}
                                  checked={selections[es.slot.id] === option}
                                  onChange={(e) => handleSelectionChange(es.slot.id, e.target.value)}
                                  className="w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-gray-700">{option}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 3: Stock Items (Bonus) */}
                {stockSlots.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-700">3. Stock Items</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      {stockSlots.map(es => (
                        <div key={es.slot.id} className="flex items-center p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                          <label className="flex items-center gap-4 cursor-pointer w-full">
                            <input
                              type="checkbox"
                              checked={!!selections[es.slot.id]}
                              onChange={(e) => handleSelectionChange(es.slot.id, e.target.checked)}
                              className="w-6 h-6 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{es.slot.name}</p>
                              <p className="text-sm text-gray-500">{es.slot.item_name || 'Bonus Item'}</p>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={resetState}
                    className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDistribute}
                    disabled={!isReadyToDistribute() || distributing}
                    className="px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-xl shadow-lg transition-all transform active:scale-[0.98] flex-[2] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {distributing ? 'Processing...' : 'Distribute Items'}
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

          {/* Right Panel: History / Tabs */}
          <div className="w-80 flex flex-col gap-4">
            <div className="flex bg-white rounded-lg shadow-sm p-1 border border-gray-200">
              <button
                onClick={() => setShowHistory(false)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${!showHistory ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Process Item
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${showHistory ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                History
              </button>
            </div>

            {showHistory && (
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
                    history.map(record => (
                      <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-900">#{record.employee?.employee_number}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(record.issued_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{record.employee?.name}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

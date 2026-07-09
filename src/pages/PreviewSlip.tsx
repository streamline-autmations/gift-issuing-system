import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateSlipHtml } from '@/utils/printSlip'
import type { Employee, GiftSlot, Issuing } from '@/types'

const dummyEmployee: Employee = {
  id: 'preview-001',
  company_id: 'preview-company',
  issuing_id: 'preview-issuing',
  employee_number: 'EMP-4821',
  first_name: 'John',
  last_name: 'Mokoena',
}

const fallbackItems = [
  { slotName: 'PPE Kit', itemName: 'Safety Boots Size 9', isChoice: false },
  { slotName: 'Clothing', itemName: 'Overall - Large', isChoice: true },
  { slotName: 'Headgear', itemName: 'Hard Hat (White)', isChoice: false },
]

export default function PreviewSlip() {
  const [loading, setLoading] = useState(true)
  const [companyName, setCompanyName] = useState('')
  const [currentIssuing, setCurrentIssuing] = useState<Issuing | null>(null)
  const [items, setItems] = useState(fallbackItems)
  const [usingSampleData, setUsingSampleData] = useState(false)

  const load = async () => {
    setLoading(true)

    const activeIssuingId = localStorage.getItem('activeIssuingId')

    if (!activeIssuingId) {
      setUsingSampleData(true)
      setCurrentIssuing(null)
      setCompanyName('NSA Mining')
      setItems(fallbackItems)
      setLoading(false)
      return
    }

    const { data: issuing, error: issuingError } = await supabase
      .from('issuings')
      .select('id, company_id, name, mine_name, is_active, created_at')
      .eq('id', activeIssuingId)
      .maybeSingle()

    if (issuingError || !issuing) {
      setUsingSampleData(true)
      setCurrentIssuing(null)
      setCompanyName('NSA Mining')
      setItems(fallbackItems)
      setLoading(false)
      return
    }

    setUsingSampleData(false)
    setCurrentIssuing(issuing as Issuing)

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', issuing.company_id)
      .maybeSingle()

    setCompanyName(company?.name || '')

    const { data: slots } = await supabase
      .from('gift_slots')
      .select('id, issuing_id, company_id, name, is_choice, created_at, gift_options(id, slot_id, company_id, item_name, stock_quantity, created_at)')
      .eq('issuing_id', activeIssuingId)
      .order('created_at', { ascending: true })

    const slotList = (slots ?? []) as GiftSlot[]

    if (slotList.length === 0) {
      setItems(fallbackItems)
    } else {
      setItems(
        slotList.map((slot) => {
          const firstOption = slot.gift_options?.[0]
          return {
            slotName: slot.name || 'Unnamed slot',
            itemName: firstOption?.item_name ?? 'No option configured',
            isChoice: slot.is_choice,
          }
        }),
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const slipHtml = generateSlipHtml({
    companyName: companyName || 'Company',
    issuingName: currentIssuing?.name || 'December 2026 Gift Distribution',
    mineName: currentIssuing?.mine_name || 'Marikana West',
    issuedAt: new Date().toISOString(),
    employee: dummyEmployee,
    items,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Slip Preview</h1>
          <p className="text-sm text-slate-600">
            {usingSampleData
              ? 'No active issuing selected on the Issue page — showing sample data.'
              : `Showing your current issuing: ${currentIssuing?.name} (${currentIssuing?.mine_name}). Employee and gift slot layout are for illustration; items reflect this issuing's configured gift slots.`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      <div className="flex justify-center">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
          <iframe
            srcDoc={slipHtml}
            title="Slip Preview"
            className="border border-slate-300 rounded"
            style={{ width: '320px', height: '500px' }}
          />
        </div>
      </div>
    </div>
  )
}

import { generateSlipHtml } from '@/utils/printSlip'
import type { Employee } from '@/types'

const dummyEmployee: Employee = {
  id: 'preview-001',
  company_id: 'preview-company',
  issuing_id: 'preview-issuing',
  employee_number: 'EMP-4821',
  first_name: 'John',
  last_name: 'Mokoena',
  extra_data: { Department: 'Underground', Shaft: 'Shaft 4' },
}

const dummyItems = [
  { slotName: 'PPE Kit', itemName: 'Safety Boots Size 9', isChoice: false },
  { slotName: 'Clothing', itemName: 'Overall - Large', isChoice: true },
  { slotName: 'Headgear', itemName: 'Hard Hat (White)', isChoice: false },
]

const slipHtml = generateSlipHtml({
  companyName: 'NSA Mining',
  issuingName: 'December 2026 Gift Distribution',
  mineName: 'Marikana West',
  issuedAt: new Date().toISOString(),
  employee: dummyEmployee,
  items: dummyItems,
})

export default function PreviewSlip() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Slip Preview</h1>
          <p className="text-sm text-slate-600">
            This is exactly how the slip will look when printed. Uses dummy data.
          </p>
        </div>
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

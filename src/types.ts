export interface Issuing {
  id: string
  name: string
  company_id: string
  is_active: boolean
}

export interface Employee {
  id: string
  employee_number: string
  name: string
  issuing_id: string
  extra_data?: Record<string, any>
  // Add other employee fields as needed
}

export interface Slot {
  id: string
  name: string
  description?: string
  is_choice: boolean
  is_bonus: boolean // To distinguish Stock Items (Section 3) vs To Process (Section 1)
  item_name?: string // For fixed slots
  options?: string[] // For choice slots (simple array of strings for options)
}

export interface EmployeeSlot {
  id: string // allocation id
  employee_id: string
  slot_id: string
  slot: Slot
}

export interface IssuedRecord {
  id: string
  employee_id: string
  issuing_id: string
  issued_at: string
  operator_id: string
  employee?: Employee // For history display
}

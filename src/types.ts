export interface Issuing {
  id: string
  company_id: string
  name: string
  mine_name: string
  is_active: boolean
  created_at?: string
}

export interface Employee {
  id: string
  company_id: string
  issuing_id: string
  employee_number: string
  first_name?: string | null
  last_name?: string | null
  extra_data?: Record<string, any>
  created_at?: string
}

export interface GiftSlot {
  id: string
  issuing_id: string
  company_id: string
  name: string
  is_choice: boolean
  created_at?: string
  gift_options?: GiftOption[]
}

export interface GiftOption {
  id: string
  slot_id: string
  company_id: string
  item_name: string
  created_at?: string
}

export interface EmployeeSlot {
  id: string
  employee_id: string
  slot_id: string
  company_id: string
  slot: GiftSlot
}

export interface IssuedRecord {
  id: string
  company_id: string
  issuing_id: string
  employee_id: string
  issued_at: string
  notes?: string | null
  employee?: Pick<Employee, 'employee_number' | 'first_name' | 'last_name'>
}

export interface IssuedSelection {
  id: string
  issued_record_id: string
  slot_id: string
  gift_option_id: string
  company_id: string
  gift_option?: Pick<GiftOption, 'item_name'>
  slot?: Pick<GiftSlot, 'name' | 'is_choice'>
}

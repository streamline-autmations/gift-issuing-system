import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/Modal'

type Company = {
  id: string
  name: string
  created_at: string
}

type Issuing = {
  id: string
  company_id: string
  name: string
  mine_name: string
  is_active: boolean
  created_at: string
}

type GiftOption = {
  id: string
  item_name: string
  stock_quantity: number | null
  created_at: string
}

type GiftSlot = {
  id: string
  issuing_id: string
  name: string
  is_choice: boolean
  created_at: string
  gift_options: GiftOption[]
}

function formatDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString()
}

function SidebarButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'w-full rounded-lg bg-slate-900 px-3 py-2 text-left text-sm font-semibold text-white'
          : 'w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100'
      }
    >
      {label}
    </button>
  )
}

function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Company[]
    },
  })
}

function CompaniesSection() {
  const qc = useQueryClient()
  const companiesQuery = useCompanies()

  const [open, setOpen] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [operatorEmail, setOperatorEmail] = useState('')
  const [operatorPassword, setOperatorPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-create-company', {
        body: {
          company_name: companyName,
          operator_email: operatorEmail,
          operator_password: operatorPassword,
        },
      })
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      setMessage('Company created successfully.')
      setError(null)
      setOpen(false)
      setCompanyName('')
      setOperatorEmail('')
      setOperatorPassword('')
      await qc.invalidateQueries({ queryKey: ['companies'] })
    },
    onError: () => {
      setMessage(null)
      setError('Could not create company. Please check details and try again.')
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Companies</h2>
          <p className="text-sm text-slate-600">Manage companies and operator logins.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={() => {
            setMessage(null)
            setError(null)
            setOpen(true)
          }}
        >
          Create Company
        </button>
      </div>

      {message ? <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {companiesQuery.isLoading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={2}>
                  Loading...
                </td>
              </tr>
            ) : companiesQuery.data?.length ? (
              companiesQuery.data.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(c.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={2}>
                  No companies yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Create Company" onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setMessage(null)
            setError(null)
            createMutation.mutate()
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Company name</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Operator email</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={operatorEmail}
              type="email"
              onChange={(e) => setOperatorEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Operator password</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={operatorPassword}
              type="password"
              onChange={(e) => setOperatorPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
          </button>

          <p className="text-xs text-slate-500">
            Creating the operator uses a Supabase Admin API function; it must be deployed in your Supabase project.
          </p>
        </form>
      </Modal>
    </div>
  )
}

function IssuingsSection() {
  const qc = useQueryClient()
  const companiesQuery = useCompanies()
  const [companyId, setCompanyId] = useState<string>('')

  const issuingsQuery = useQuery({
    queryKey: ['issuings', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issuings')
        .select('id, company_id, name, mine_name, is_active, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Issuing[]
    },
  })

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [mineName, setMineName] = useState('')

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('issuings')
        .insert({ id: crypto.randomUUID(), company_id: companyId, name: name.trim(), mine_name: mineName.trim(), is_active: true })
      if (error) throw error
    },
    onSuccess: async () => {
      setOpen(false)
      setName('')
      setMineName('')
      await qc.invalidateQueries({ queryKey: ['issuings', companyId] })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ issuingId, isActive }: { issuingId: string; isActive: boolean }) => {
      const { error } = await supabase.from('issuings').update({ is_active: isActive }).eq('id', issuingId)
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['issuings', companyId] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Issuings</h2>
          <p className="text-sm text-slate-600">Create issuings and manage active status.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          onClick={() => setOpen(true)}
          disabled={!companyId}
        >
          Create New Issuing
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Mine</th>
              <th className="px-4 py-3 font-semibold">Active</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {!companyId ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>
                  Select a company to view issuings.
                </td>
              </tr>
            ) : issuingsQuery.isLoading ? (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>
                  Loading...
                </td>
              </tr>
            ) : issuingsQuery.data?.length ? (
              issuingsQuery.data.map((i) => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{i.name}</td>
                  <td className="px-4 py-3 text-slate-600">{i.mine_name}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={
                        i.is_active
                          ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800'
                          : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700'
                      }
                      onClick={() => toggleMutation.mutate({ issuingId: i.id, isActive: !i.is_active })}
                      disabled={toggleMutation.isPending}
                    >
                      {i.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(i.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={4}>
                  No issuings for this company.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Create Issuing" onClose={() => setOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate()
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Issuing name</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Mine name</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={mineName}
              onChange={(e) => setMineName(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function GiftsSection() {
  const qc = useQueryClient()
  const companiesQuery = useCompanies()

  const [companyId, setCompanyId] = useState<string>('')
  const [issuingId, setIssuingId] = useState<string>('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [editSlotOpen, setEditSlotOpen] = useState(false)
  const [editSlotId, setEditSlotId] = useState<string>('')
  const [editSlotName, setEditSlotName] = useState('')
  const [editSlotIsChoice, setEditSlotIsChoice] = useState(true)
  const [editSlotIsChoiceLocked, setEditSlotIsChoiceLocked] = useState(false)

  const [editOptionOpen, setEditOptionOpen] = useState(false)
  const [editOptionId, setEditOptionId] = useState<string>('')
  const [editOptionName, setEditOptionName] = useState('')
  const [editOptionQty, setEditOptionQty] = useState<string>('')

  const issuingsQuery = useQuery({
    queryKey: ['issuings', companyId, 'for-gifts'],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issuings')
        .select('id, company_id, name, mine_name, is_active, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Issuing[]
    },
  })

  const slotsQuery = useQuery({
    queryKey: ['gift-slots', issuingId],
    enabled: Boolean(issuingId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gift_slots')
        .select('id, issuing_id, company_id, name, is_choice, created_at, gift_options(id, item_name, stock_quantity, created_at)')
        .eq('issuing_id', issuingId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []) as GiftSlot[]
    },
  })

  useEffect(() => {
    setIssuingId('')
  }, [companyId])

  const [slotOpen, setSlotOpen] = useState(false)
  const [slotName, setSlotName] = useState('')
  const [slotIsChoice, setSlotIsChoice] = useState(true)

  const createSlotMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('gift_slots')
        .insert({ id: crypto.randomUUID(), issuing_id: issuingId, company_id: companyId, name: slotName.trim(), is_choice: slotIsChoice })
      if (error) throw error
    },
    onSuccess: async () => {
      setSlotOpen(false)
      setSlotName('')
      setSlotIsChoice(true)
      await qc.invalidateQueries({ queryKey: ['gift-slots', issuingId] })
    },
  })

  const addOptionMutation = useMutation({
    mutationFn: async ({ slotId, name, stock_quantity }: { slotId: string; name: string; stock_quantity: number | null }) => {
      const { error } = await supabase
        .from('gift_options')
        .insert({ id: crypto.randomUUID(), slot_id: slotId, company_id: companyId, item_name: name.trim(), stock_quantity })
      if (error) throw error
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['gift-slots', issuingId] })
    },
  })

  const updateSlotMutation = useMutation({
    mutationFn: async ({
      slotId,
      name,
      is_choice,
      lockChoice,
    }: {
      slotId: string
      name: string
      is_choice: boolean
      lockChoice: boolean
    }) => {
      if (!lockChoice) {
        const { data: anyEmployeeSlots } = await supabase
          .from('employee_slots')
          .select('id')
          .eq('slot_id', slotId)
          .limit(1)

        const { data: anyIssued } = await supabase
          .from('issued_selections')
          .select('id')
          .eq('slot_id', slotId)
          .limit(1)

        if ((anyEmployeeSlots && anyEmployeeSlots.length > 0) || (anyIssued && anyIssued.length > 0)) {
          throw new Error('Cannot change slot type after it has been used. You can still rename it.')
        }
      }

      const update: any = { name: name.trim() }
      if (!lockChoice) update.is_choice = is_choice

      const { error } = await supabase.from('gift_slots').update(update).eq('id', slotId)
      if (error) throw error
    },
    onSuccess: async () => {
      setEditSlotOpen(false)
      setEditSlotId('')
      setEditSlotName('')
      setEditSlotIsChoice(true)
      setEditSlotIsChoiceLocked(false)
      await qc.invalidateQueries({ queryKey: ['gift-slots', issuingId] })
    },
    onError: (e: any) => {
      setMessage(null)
      setError(e?.message || 'Could not update gift slot.')
    },
  })

  const updateOptionMutation = useMutation({
    mutationFn: async ({ optionId, name, stock_quantity }: { optionId: string; name: string; stock_quantity: number | null }) => {
      const { error } = await supabase
        .from('gift_options')
        .update({ item_name: name.trim(), stock_quantity })
        .eq('id', optionId)
      if (error) throw error
    },
    onSuccess: async () => {
      setEditOptionOpen(false)
      setEditOptionId('')
      setEditOptionName('')
      setEditOptionQty('')
      await qc.invalidateQueries({ queryKey: ['gift-slots', issuingId] })
    },
    onError: (e: any) => {
      setMessage(null)
      setError(e?.message || 'Could not update gift option.')
    },
  })

  const deleteSlotMutation = useMutation({
    mutationFn: async ({ slotId }: { slotId: string }) => {
      const { data: anyEmployeeSlots } = await supabase
        .from('employee_slots')
        .select('id')
        .eq('slot_id', slotId)
        .limit(1)

      if (anyEmployeeSlots && anyEmployeeSlots.length > 0) {
        throw new Error('This slot has employees assigned. Remove employees/allocations first.')
      }

      const { data: anyIssued } = await supabase
        .from('issued_selections')
        .select('id')
        .eq('slot_id', slotId)
        .limit(1)

      if (anyIssued && anyIssued.length > 0) {
        throw new Error('This slot has already been issued. Cannot delete it.')
      }

      const { error } = await supabase.from('gift_slots').delete().eq('id', slotId)
      if (error) throw error
    },
    onSuccess: async () => {
      setMessage('Gift slot deleted.')
      setError(null)
      await qc.invalidateQueries({ queryKey: ['gift-slots', issuingId] })
    },
    onError: (e: any) => {
      setMessage(null)
      setError(e?.message || 'Could not delete gift slot.')
    },
  })

  const deleteOptionMutation = useMutation({
    mutationFn: async ({ optionId }: { optionId: string }) => {
      const { data: anyIssued } = await supabase
        .from('issued_selections')
        .select('id')
        .eq('gift_option_id', optionId)
        .limit(1)

      if (anyIssued && anyIssued.length > 0) {
        throw new Error('This option has already been issued. Cannot delete it.')
      }

      const { error } = await supabase.from('gift_options').delete().eq('id', optionId)
      if (error) throw error
    },
    onSuccess: async () => {
      setMessage('Gift option deleted.')
      setError(null)
      await qc.invalidateQueries({ queryKey: ['gift-slots', issuingId] })
    },
    onError: (e: any) => {
      setMessage(null)
      setError(e?.message || 'Could not delete gift option.')
    },
  })

  const expandedDefault = useMemo(() => new Set<string>(), [])
  const [expanded, setExpanded] = useState<Set<string>>(expandedDefault)

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Gifts</h2>
          <p className="text-sm text-slate-600">Configure gift slots and options per issuing.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          onClick={() => setSlotOpen(true)}
          disabled={!issuingId}
        >
          Add Gift Slot
        </button>
      </div>

      {message ? <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
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

        <div className="rounded-xl border border-slate-200 bg-white p-4">
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

      <div className="space-y-3">
        {!issuingId ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Select a company and issuing to manage gift slots.
          </div>
        ) : slotsQuery.isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading...</div>
        ) : slotsQuery.data?.length ? (
          slotsQuery.data.map((slot) => {
            const isExpanded = expanded.has(slot.id)
            const options = slot.gift_options ?? []
            const fixedLimitReached = !slot.is_choice && options.length >= 1

            return (
              <div key={slot.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggleExpanded(slot.id)}
                  className="flex w-full items-center justify-between px-5 py-4"
                >
                  <div className="text-left">
                    <div className="text-sm font-semibold text-slate-900">{slot.name}</div>
                    <div className="text-xs text-slate-600">{slot.is_choice ? 'Choice slot' : 'Fixed slot'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      disabled={updateSlotMutation.isPending}
                      onClick={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMessage(null)
                        setError(null)

                        setEditSlotId(slot.id)
                        setEditSlotName(slot.name)
                        setEditSlotIsChoice(slot.is_choice)

                        const { data: anyEmployeeSlots } = await supabase
                          .from('employee_slots')
                          .select('id')
                          .eq('slot_id', slot.id)
                          .limit(1)

                        const { data: anyIssued } = await supabase
                          .from('issued_selections')
                          .select('id')
                          .eq('slot_id', slot.id)
                          .limit(1)

                        const locked = Boolean((anyEmployeeSlots && anyEmployeeSlots.length > 0) || (anyIssued && anyIssued.length > 0))
                        setEditSlotIsChoiceLocked(locked)

                        setEditSlotOpen(true)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      disabled={deleteSlotMutation.isPending}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setMessage(null)
                        setError(null)
                        const ok = window.confirm('Delete this gift slot? This cannot be undone.')
                        if (!ok) return
                        deleteSlotMutation.mutate({ slotId: slot.id })
                      }}
                    >
                      Delete
                    </button>
                    <div className="text-xs font-medium text-slate-500">{isExpanded ? 'Hide' : 'Show'}</div>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <div className="space-y-2">
                      {options.length ? (
                        options.map((opt) => (
                          <div key={opt.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                            <div className="text-sm font-medium text-slate-900">
                              {opt.item_name}
                              {opt.stock_quantity === null ? null : (
                                <span className="ml-2 text-xs font-semibold text-slate-500">({opt.stock_quantity})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-xs text-slate-500">{formatDate(opt.created_at)}</div>
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                                disabled={updateOptionMutation.isPending}
                                onClick={() => {
                                  setMessage(null)
                                  setError(null)
                                  setEditOptionId(opt.id)
                                  setEditOptionName(opt.item_name)
                                  setEditOptionQty(opt.stock_quantity === null || opt.stock_quantity === undefined ? '' : String(opt.stock_quantity))
                                  setEditOptionOpen(true)
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                                disabled={deleteOptionMutation.isPending}
                                onClick={() => {
                                  setMessage(null)
                                  setError(null)
                                  const ok = window.confirm('Delete this gift option? This cannot be undone.')
                                  if (!ok) return
                                  deleteOptionMutation.mutate({ optionId: opt.id })
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-slate-600">No options yet.</div>
                      )}

                      <AddOptionRow
                        disabled={fixedLimitReached || addOptionMutation.isPending}
                        disabledReason={fixedLimitReached ? 'Fixed slot allows only 1 option.' : null}
                        onAdd={(name, stock_quantity) => addOptionMutation.mutate({ slotId: slot.id, name, stock_quantity })}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            No gift slots for this issuing.
          </div>
        )}
      </div>

      <Modal open={slotOpen} title="Add Gift Slot" onClose={() => setSlotOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            createSlotMutation.mutate()
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Slot name</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={slotName}
              onChange={(e) => setSlotName(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <div className="text-sm font-medium text-slate-900">Choice slot</div>
              <div className="text-xs text-slate-600">Allow multiple options for the operator to choose from.</div>
            </div>
            <input
              type="checkbox"
              checked={slotIsChoice}
              onChange={(e) => setSlotIsChoice(e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          <button
            type="submit"
            disabled={createSlotMutation.isPending}
            className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {createSlotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Slot'}
          </button>
        </form>
      </Modal>

      <Modal open={editSlotOpen} title="Edit Gift Slot" onClose={() => setEditSlotOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            updateSlotMutation.mutate({
              slotId: editSlotId,
              name: editSlotName,
              is_choice: editSlotIsChoice,
              lockChoice: editSlotIsChoiceLocked,
            })
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Slot name</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={editSlotName}
              onChange={(e) => setEditSlotName(e.target.value)}
              required
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <div>
              <div className="text-sm font-medium text-slate-900">Choice slot</div>
              <div className="text-xs text-slate-600">Allow multiple options for the operator to choose from.</div>
            </div>
            <input
              type="checkbox"
              checked={editSlotIsChoice}
              onChange={(e) => setEditSlotIsChoice(e.target.checked)}
              className="h-4 w-4"
              disabled={editSlotIsChoiceLocked}
            />
          </div>

          <button
            type="submit"
            disabled={updateSlotMutation.isPending}
            className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {updateSlotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
          </button>
        </form>
      </Modal>

      <Modal open={editOptionOpen} title="Edit Gift Option" onClose={() => setEditOptionOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const stock_quantity =
              editOptionQty.trim() === '' ? null : Number.isFinite(Number(editOptionQty)) ? Math.max(0, Math.trunc(Number(editOptionQty))) : null
            updateOptionMutation.mutate({ optionId: editOptionId, name: editOptionName, stock_quantity })
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Option name</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={editOptionName}
              onChange={(e) => setEditOptionName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              inputMode="numeric"
              value={editOptionQty}
              onChange={(e) => setEditOptionQty(e.target.value)}
              placeholder="Leave blank for unlimited"
            />
          </div>

          <button
            type="submit"
            disabled={updateOptionMutation.isPending}
            className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {updateOptionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function AddOptionRow({
  disabled,
  disabledReason,
  onAdd,
}: {
  disabled: boolean
  disabledReason: string | null
  onAdd: (name: string, stock_quantity: number | null) => void
}) {
  const [name, setName] = useState('')
  const [qty, setQty] = useState<string>('')

  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (disabled) return
        const next = name.trim()
        if (!next) return
        const stock_quantity =
          qty.trim() === '' ? null : Number.isFinite(Number(qty)) ? Math.max(0, Math.trunc(Number(qty))) : null
        onAdd(next, stock_quantity)
        setName('')
        setQty('')
      }}
    >
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          placeholder="New option name (e.g. Powerbank)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
        />
        <input
          className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
          placeholder="Qty"
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Add
        </button>
      </div>
      {disabledReason ? <div className="text-xs text-slate-500">{disabledReason}</div> : null}
    </form>
  )
}

export default function Admin() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<'companies' | 'issuings' | 'gifts'>('companies')

  useEffect(() => {
    if (loading) return
    if (profile?.role !== 'superadmin') navigate('/dashboard', { replace: true })
  }, [loading, profile?.role, navigate])

  if (loading) return null
  if (profile?.role !== 'superadmin') return null

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
          <p className="text-sm text-slate-600">Superadmin tools for setup and configuration.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <div className="h-fit rounded-xl border border-slate-200 bg-white p-3">
            <div className="space-y-1">
              <SidebarButton active={section === 'companies'} label="Companies" onClick={() => setSection('companies')} />
              <SidebarButton active={section === 'issuings'} label="Issuings" onClick={() => setSection('issuings')} />
              <SidebarButton active={section === 'gifts'} label="Gifts" onClick={() => setSection('gifts')} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            {section === 'companies' ? <CompaniesSection /> : null}
            {section === 'issuings' ? <IssuingsSection /> : null}
            {section === 'gifts' ? <GiftsSection /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

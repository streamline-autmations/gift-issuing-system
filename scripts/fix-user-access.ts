import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const userEmail = 'admin@africannomad.co.za'
const companyName = 'African Nomad'

async function fixUserAccess() {
  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === userEmail)
  
  if (!user) {
    console.error('User not found!')
    process.exit(1)
  }
  
  console.log('User found:', user.id)
  
  // Get company
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('name', companyName)
    .single()
  
  if (!company) {
    console.error('Company not found!')
    process.exit(1)
  }
  
  console.log('Company found:', company.name, company.id)
  
  // Update user's profile to change role from superadmin to operator AND add company_id
  // This is needed because superadmin must have null company_id, but operator must have a company_id
  const { error } = await supabase
    .from('profiles')
    .update({ role: 'operator', company_id: company.id })
    .eq('id', user.id)
  
  if (error) {
    console.error('Error updating profile:', error.message)
    process.exit(1)
  }
  
  console.log('✅ User profile updated!')
  console.log('Role changed to: operator')
  console.log('Company set to:', company.name)
  console.log('The user should now see the issuings for African Nomad.')
}

fixUserAccess()
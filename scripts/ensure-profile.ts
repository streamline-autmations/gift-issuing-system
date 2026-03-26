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
const userRole = 'superadmin' // Can be: superadmin, company_admin, operator

async function ensureProfile() {
  // Get the user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === userEmail)
  
  if (!user) {
    console.error('User not found!')
    process.exit(1)
  }
  
  console.log(`User found: ${user.id}`)
  
  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  
  if (existingProfile) {
    console.log('Profile already exists!')
    console.log(existingProfile)
    return
  }
  
  // Create profile
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      role: userRole,
      company_id: null
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating profile:', error.message)
    process.exit(1)
  }
  
  console.log('✅ Profile created!')
  console.log(data)
}

ensureProfile()
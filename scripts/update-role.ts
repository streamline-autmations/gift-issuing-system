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
const userRole = 'superadmin'

async function updateUserRole() {
  // Get the user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === userEmail)
  
  if (!user) {
    console.error('User not found!')
    process.exit(1)
  }
  
  console.log(`Updating user: ${user.id}`)
  
  // Update profile with role
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: userRole })
    .eq('id', user.id)
    .select()
    .single()
  
  if (error) {
    console.error('Error updating profile:', error.message)
    process.exit(1)
  }
  
  console.log('✅ Role updated successfully!')
  console.log(data)
}

updateUserRole()
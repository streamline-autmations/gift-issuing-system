import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY="your-key" npx tsx scripts/add-user.ts')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const newUserEmail = 'admin@africannomad.co.za'
const newUserPassword = 'admin@africannomad.co.za' // Same as email

async function createUser() {
  console.log(`Creating user: ${newUserEmail}`)
  
  // Check if user already exists
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const existingUser = users.find(u => u.email === newUserEmail)
  
  if (existingUser) {
    console.log('User already exists.')
    return
  }

  // Create new user
  const { data, error } = await supabase.auth.admin.createUser({
    email: newUserEmail,
    password: newUserPassword,
    email_confirm: true
  })

  if (error) {
    console.error('Error creating user:', error.message)
    process.exit(1)
  }

  console.log('✅ User created successfully!')
  console.log(`   Email: ${newUserEmail}`)
  console.log(`   Password: ${newUserPassword}`)
}

createUser()
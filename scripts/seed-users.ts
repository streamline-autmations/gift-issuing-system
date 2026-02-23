import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY="your-key" npx tsx scripts/seed-users.ts')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function seed() {
  console.log('🌱 Starting seed process...')

  // 1. Create Super Admin
  const superAdminEmail = 'streamline.automations.hq@gmail.com'
  const superAdminPassword = '$tud12Muffin'

  console.log(`\nCreating Super Admin: ${superAdminEmail}`)
  
  // Check if exists
  let { data: { users } } = await supabase.auth.admin.listUsers()
  let superAdmin = users.find(u => u.email === superAdminEmail)

  if (!superAdmin) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: superAdminEmail,
      password: superAdminPassword,
      email_confirm: true
    })
    if (error) {
      console.error('Error creating super admin:', error.message)
    } else {
      superAdmin = data.user
      console.log('✅ Super Admin created.')
    }
  } else {
    console.log('ℹ️ Super Admin already exists.')
  }

  if (superAdmin) {
    // Update Profile
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'superadmin' })
      .eq('id', superAdmin.id)
    
    if (error) console.error('Error updating super admin profile:', error.message)
    else console.log('✅ Super Admin profile updated (role=superadmin).')
  }

  // 2. Create "Best Deals" Company
  console.log('\nCreating "Best Deals" Company...')
  let companyId: string | null = null

  const { data: existingCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('name', 'Best Deals')
    .maybeSingle()

  if (existingCompany) {
    companyId = existingCompany.id
    console.log('ℹ️ "Best Deals" company already exists.')
  } else {
    const { data, error } = await supabase
      .from('companies')
      .insert({ name: 'Best Deals' })
      .select('id')
      .single()
    
    if (error) {
      console.error('Error creating company:', error.message)
    } else if (data) {
      companyId = data.id
      console.log('✅ "Best Deals" company created.')
    }
  }

  // 3. Create "Best Deals" Operator
  if (companyId) {
    const operatorEmail = 'operator@bestdeals.com'
    const operatorPassword = 'BestDealsUser1!'

    console.log(`\nCreating Best Deals Operator: ${operatorEmail}`)

    // Refresh user list or check specifically
    // We can't filter listUsers by email easily without iterating, but we already have `users` from before.
    // Better to just try create or rely on error.
    
    // Check if exists in our previously fetched list (might be stale if we just created, but unlikely for this flow)
    let operator = users.find(u => u.email === operatorEmail)

    if (!operator) {
      // Try fetch again to be sure
      const { data: { users: freshUsers } } = await supabase.auth.admin.listUsers()
      operator = freshUsers.find(u => u.email === operatorEmail)
    }

    if (!operator) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: operatorEmail,
        password: operatorPassword,
        email_confirm: true
      })
      if (error) {
        console.error('Error creating operator:', error.message)
      } else {
        operator = data.user
        console.log('✅ Operator created.')
        console.log(`👉 Credentials: ${operatorEmail} / ${operatorPassword}`)
      }
    } else {
      console.log('ℹ️ Operator already exists.')
      // If operator exists but we want to make sure the profile is correct for this run:
      // (Optional: Update password if you wanted to reset it, but better not to)
    }

    if (operator) {
      // Update Profile
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'operator', company_id: companyId })
        .eq('id', operator.id)
      
      if (error) console.error('Error updating operator profile:', error.message)
      else console.log('✅ Operator profile updated (role=operator, linked to company).')
    }
  }

  console.log('\n✨ Seed complete!')
  console.log('\n--- Login Credentials ---')
  console.log('Super Admin: streamline.automations.hq@gmail.com / $tud12Muffin')
  console.log('Best Deals Operator: operator@bestdeals.com / BestDealsUser1!')
  console.log('-------------------------')
}

seed().catch(console.error)

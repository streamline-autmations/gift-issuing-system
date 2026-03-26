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

const companyName = 'African Nomad'
const operatorEmail = 'admin@africannomad.co.za'
const operatorPassword = 'admin@africannomad.co.za'

async function createCompanyAndOperator() {
  console.log(`Creating company: ${companyName}`)
  
  // Check if company already exists
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('name', companyName)
    .maybeSingle()
  
  let companyId
  if (existingCompany) {
    console.log('Company already exists:', existingCompany.id)
    companyId = existingCompany.id
  } else {
    // Create company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert({ name: companyName })
      .select('id, name, created_at')
      .single()
    
    if (companyError) {
      console.error('Error creating company:', companyError.message)
      process.exit(1)
    }
    
    companyId = company.id
    console.log('✅ Company created:', company.name)
  }
  
  // Check if operator user exists
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const existingUser = users.find(u => u.email === operatorEmail)
  
  if (!existingUser) {
    console.error('User does not exist!')
    process.exit(1)
  }
  
  console.log('User found:', existingUser.id)
  
  // Update profile to add company_id
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ company_id: companyId })
    .eq('id', existingUser.id)
  
  if (updateError) {
    console.error('Error updating profile:', updateError.message)
    process.exit(1)
  }
  
  console.log('✅ Profile updated with company_id')
  
  console.log('\n🎉 All done!')
  console.log(`Company: ${companyName} (${companyId})`)
  console.log(`Operator: ${operatorEmail} / ${operatorPassword}`)
  console.log('\nNow you can log in and create a company from the app!')
}

createCompanyAndOperator()
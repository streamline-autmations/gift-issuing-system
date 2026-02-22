import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type CreateCompanyRequest = {
  company_name: string
  operator_email: string
  operator_password: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const token = authHeader.replace('Bearer', '').trim()
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)

  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const requesterId = userData.user.id
  const { data: requesterProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', requesterId)
    .maybeSingle()

  if (profileError || requesterProfile?.role !== 'superadmin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: CreateCompanyRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const companyName = (body.company_name ?? '').trim()
  const operatorEmail = (body.operator_email ?? '').trim()
  const operatorPassword = body.operator_password ?? ''

  if (!companyName || !operatorEmail || operatorPassword.length < 6) {
    return new Response(
      JSON.stringify({ error: 'company_name, operator_email, operator_password are required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .insert({ name: companyName })
    .select('id, name, created_at')
    .single()

  if (companyError) {
    return new Response(JSON.stringify({ error: 'Failed to create company' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: operatorEmail,
    password: operatorPassword,
    email_confirm: true,
  })

  if (createUserError || !createdUser.user) {
    await supabaseAdmin.from('companies').delete().eq('id', company.id)
    return new Response(JSON.stringify({ error: 'Failed to create operator user' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const operatorId = createdUser.user.id

  const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
    id: operatorId,
    company_id: company.id,
    role: 'operator',
  })

  if (profileInsertError) {
    await supabaseAdmin.auth.admin.deleteUser(operatorId)
    await supabaseAdmin.from('companies').delete().eq('id', company.id)
    return new Response(JSON.stringify({ error: 'Failed to create operator profile' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      company,
      operator_user_id: operatorId,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
})


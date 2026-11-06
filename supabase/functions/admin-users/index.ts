// Edge Function: admin-users
// Login restrito (doc 22): só o usuário MASTER cria contas e bloqueia/desbloqueia acessos.
// Criar e banir são operações da API admin → exigem service_role, que NUNCA pode ir para o app.
// A function verifica que quem chamou é master e só então usa a service_role.
//
// Deploy (uma vez, pelo dono):
//   supabase functions deploy admin-users
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da function)
//
// Corpo:
//   { action: 'create', name, email, password, role }   role: 'admin' | 'suporte' | 'member'
//   { action: 'block' | 'unblock', userId }

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

/** Bloqueio "sem prazo": a API só aceita duração, então usamos 100 anos. */
const BLOCK_FOREVER = '876000h'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

interface Body {
  action?: string
  userId?: string
  name?: string
  email?: string
  password?: string
  role?: string
}

async function createUser(body: Body) {
  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const role = body.role ?? 'member'

  if (!name) return json({ error: 'Informe o nome.' }, 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'E-mail inválido.' }, 400)
  if (password.length < 6) return json({ error: 'A senha precisa de ao menos 6 caracteres.' }, 400)
  if (!['admin', 'suporte', 'member'].includes(role)) return json({ error: 'Papel inválido.' }, 400)

  // email_confirm: sem isso o login falha com "Email not confirmed".
  // must_change_password: o app obriga a trocar a senha no 1º acesso.
  // O gatilho handle_new_user cria o perfil a partir do display_name.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name, must_change_password: true },
  })
  if (error || !data.user) {
    const exists = error?.code === 'email_exists' || /already/i.test(error?.message ?? '')
    if (exists) return json({ error: 'Já existe uma conta com este e-mail.' }, 409)
    return json({ error: error?.message ?? 'Falha ao criar o usuário.' }, 400)
  }

  // Sem linha em user_roles o papel é "member". Se o papel falhar, desfaz a conta recém-criada
  // (ainda sem nenhuma nota) para não deixar um acesso com papel diferente do escolhido.
  if (role !== 'member') {
    const { error: roleErr } = await admin
      .from('user_roles')
      .upsert({ user_id: data.user.id, role, updated_at: new Date().toISOString() })
    if (roleErr) {
      await admin.auth.admin.deleteUser(data.user.id)
      return json({ error: 'Não foi possível definir o papel. Nada foi criado.' }, 500)
    }
  }

  return json({ ok: true, userId: data.user.id })
}

async function setBlocked(body: Body, callerId: string, blocked: boolean) {
  const userId = (body.userId ?? '').trim()
  if (!userId) return json({ error: 'userId obrigatório.' }, 400)
  if (userId === callerId) return json({ error: 'Você não pode bloquear a própria conta.' }, 400)

  const { data: target } = await admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle()
  if (target?.role === 'master') return json({ error: 'A conta master não pode ser bloqueada.' }, 400)

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: blocked ? BLOCK_FOREVER : 'none',
  })
  if (error) return json({ error: error.message }, 400)
  return json({ ok: true })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  // 1) Identifica quem chamou pelo JWT do header.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'sem token' }, 401)

  const { data: caller, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller?.user) return json({ error: 'token inválido' }, 401)

  // 2) Confirma que o chamador é MASTER (a service_role ignora RLS, então checamos direto).
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', caller.user.id)
    .maybeSingle()
  if (roleRow?.role !== 'master') return json({ error: 'Apenas o master pode fazer isso.' }, 403)

  // 3) Executa a ação pedida.
  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corpo inválido' }, 400)
  }

  switch (body.action) {
    case 'create':
      return createUser(body)
    case 'block':
      return setBlocked(body, caller.user.id, true)
    case 'unblock':
      return setBlocked(body, caller.user.id, false)
    default:
      return json({ error: 'ação inválida' }, 400)
  }
})

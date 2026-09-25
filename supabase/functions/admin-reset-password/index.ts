// Edge Function: admin-reset-password
// Permite que o usuário MASTER defina uma nova senha para QUALQUER usuário, sem ver a senha atual.
// Definir a senha de outra conta é operação admin-API → exige service_role, que NUNCA pode ir para o
// app. Por isso fica aqui: a function verifica que quem chamou é master e só então usa a service_role.
//
// Deploy (uma vez, pelo dono):
//   supabase functions deploy admin-reset-password
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da function)
// O app chama via supabase.functions.invoke('admin-reset-password', { body: { userId, password } }).

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

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
  if (roleRow?.role !== 'master') return json({ error: 'apenas o master pode fazer isso' }, 403)

  // 3) Valida a entrada e troca a senha do alvo.
  let body: { userId?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'corpo inválido' }, 400)
  }
  const userId = (body.userId ?? '').trim()
  const password = body.password ?? ''
  if (!userId) return json({ error: 'userId obrigatório' }, 400)
  if (password.length < 6) return json({ error: 'a senha precisa de ao menos 6 caracteres' }, 400)
  if (userId === caller.user.id) return json({ error: 'use o fluxo normal para a sua própria senha' }, 400)

  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password })
  if (updErr) return json({ error: updErr.message }, 400)

  return json({ ok: true })
})

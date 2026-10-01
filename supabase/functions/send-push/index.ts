// Edge Function: send-push
// Recebe do banco (trigger fcm_dispatch, migração 0027) uma linha nova de `notifications` ou de
// `dm_messages`, resolve o destinatário e seus tokens FCM, e envia a notificação via FCM HTTP v1.
// O Android exibe a notificação MESMO com o app fechado (é o que o cliente-only não cobre).
//
// Deploy:
//   supabase functions deploy send-push --no-verify-jwt
//   supabase secrets set PUSH_SECRET='<o mesmo segredo de private.push_config.secret>'
//   FCM_SERVICE_ACCOUNT: JSON do service account, cru OU base64 (base64 é à prova de shell/Windows).
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da function)
//
// O service-account.json vem do Firebase → Configurações do projeto → Contas de serviço →
// "Gerar nova chave privada". É o MESMO projeto do google-services.json do app Android.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PUSH_SECRET = Deno.env.get('PUSH_SECRET') ?? ''
const SA_RAW = Deno.env.get('FCM_SERVICE_ACCOUNT') ?? ''

interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

// Aceita o FCM_SERVICE_ACCOUNT como JSON puro OU base64(JSON). O base64 evita todo problema de
// aspas/quebra de linha ao setar o secret (especialmente no PowerShell/Windows).
function loadServiceAccount(raw: string): ServiceAccount | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const parse = (t: string): ServiceAccount | null => {
    try {
      const o = JSON.parse(t)
      return o && o.client_email && o.private_key && o.project_id ? (o as ServiceAccount) : null
    } catch {
      return null
    }
  }
  const direct = parse(s)
  if (direct) return direct
  try {
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(s.replace(/\s+/g, '')), (c) => c.charCodeAt(0)),
    )
    return parse(decoded)
  } catch {
    return null
  }
}
const SA: ServiceAccount | null = loadServiceAccount(SA_RAW)

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// ── OAuth2: service account → access token (cacheado enquanto a instância vive) ─────────────────
let cachedToken: { value: string; exp: number } | null = null

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlStr(str: string): string {
  return b64url(new TextEncoder().encode(str))
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.value

  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(claim))}`
  const key = await importPrivateKey(sa.private_key)
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${b64url(new Uint8Array(sigBuf))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const j = await res.json()
  if (!res.ok || !j.access_token) {
    throw new Error(`OAuth falhou: ${res.status} ${JSON.stringify(j)}`)
  }
  cachedToken = { value: j.access_token, exp: now + (j.expires_in ?? 3600) }
  return j.access_token
}

// ── FCM HTTP v1 ─────────────────────────────────────────────────────────────────────────────
async function sendFcm(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ ok: boolean; unregistered: boolean }> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data,
        android: { priority: 'HIGH', notification: { sound: 'default' } },
      },
    }),
  })
  if (res.ok) return { ok: true, unregistered: false }
  const errText = await res.text()
  // Token morto (app desinstalado / token rotacionado) → limpar do banco.
  const unregistered =
    res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/i.test(errText)
  console.warn('[send-push] FCM erro', res.status, errText.slice(0, 200))
  return { ok: false, unregistered }
}

// ── Resolve destinatário + texto conforme a origem ───────────────────────────────────────────
interface Target {
  userId: string
  title: string
  body: string
  data: Record<string, string>
}

async function resolveTarget(table: string, rec: Record<string, unknown>): Promise<Target | null> {
  if (table === 'notifications') {
    const userId = String(rec.user_id ?? '')
    if (!userId) return null
    let actorName = 'Alguém'
    if (rec.actor_id) {
      const { data } = await admin
        .from('profiles')
        .select('display_name')
        .eq('id', rec.actor_id)
        .maybeSingle()
      actorName = (data as { display_name?: string } | null)?.display_name ?? actorName
    }
    const noteTitle = String(rec.title ?? '')
    const bodyTxt = `${actorName} ${String(rec.body ?? '')}`.trim() + (noteTitle ? ` “${noteTitle}”` : '')
    return {
      userId,
      title: 'SB Notas',
      body: bodyTxt || 'Você tem uma novidade',
      data: {
        type: 'notification',
        notifType: String(rec.type ?? ''),
        noteId: rec.note_id ? String(rec.note_id) : '',
      },
    }
  }

  if (table === 'dm_messages') {
    const convId = String(rec.conversation_id ?? '')
    const senderId = String(rec.sender_id ?? '')
    if (!convId || !senderId) return null
    const { data: conv } = await admin
      .from('dm_conversations')
      .select('user_a, user_b')
      .eq('id', convId)
      .maybeSingle()
    if (!conv) return null
    const c = conv as { user_a: string; user_b: string }
    const recipient = c.user_a === senderId ? c.user_b : c.user_a
    const { data: sender } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', senderId)
      .maybeSingle()
    const senderName =
      (sender as { display_name?: string } | null)?.display_name?.split(' ')[0] ?? 'Mensagem'
    const raw = String(rec.body ?? '')
    return {
      userId: recipient,
      title: senderName,
      body: raw.length > 120 ? raw.slice(0, 117) + '…' : raw || 'Nova mensagem',
      data: { type: 'dm', conversationId: convId, senderId },
    }
  }

  return null
}

Deno.serve(async (req) => {
  if (PUSH_SECRET && req.headers.get('x-push-secret') !== PUSH_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }
  if (!SA) {
    return json({ error: 'FCM_SERVICE_ACCOUNT ausente/inválido', hadValue: !!SA_RAW }, 500)
  }

  let payload: { table?: string; record?: Record<string, unknown> }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'body inválido' }, 400)
  }
  const table = payload.table ?? ''
  const record = payload.record ?? {}

  const target = await resolveTarget(table, record)
  if (!target) return json({ skipped: 'sem destinatário' })

  const { data: tokenRows } = await admin
    .from('fcm_tokens')
    .select('token')
    .eq('user_id', target.userId)
  const tokens = (tokenRows ?? []).map((r) => (r as { token: string }).token)
  if (tokens.length === 0) return json({ sent: 0, reason: 'sem tokens' })

  const accessToken = await getAccessToken(SA)
  let sent = 0
  const dead: string[] = []
  for (const tk of tokens) {
    const r = await sendFcm(accessToken, SA.project_id, tk, target.title, target.body, target.data)
    if (r.ok) sent += 1
    else if (r.unregistered) dead.push(tk)
  }
  if (dead.length > 0) {
    await admin.from('fcm_tokens').delete().in('token', dead)
  }

  return json({ sent, cleaned: dead.length })
})

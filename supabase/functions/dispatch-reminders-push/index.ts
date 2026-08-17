// Edge Function: dispatch-reminders-push
// Varre lembretes vencidos e envia Web Push aos alvos (dono + compartilhados + membros do quadro).
// Agendada por pg_cron (ver README.md desta pasta). Usa service_role (ignora RLS).
//
// Deploy:
//   supabase functions deploy dispatch-reminders-push --no-verify-jwt
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:voce@dominio
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente da function)
// Gerar VAPID: `npx web-push generate-vapid-keys` (a pública também vai no .env do front).

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '' // opcional: protege o endpoint

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

interface NoteRow {
  id: string
  title: string
  body: string
  owner_id: string
  workspace_id: string | null
  remind_at: string
  pushed_at: string | null
}
interface SubRow {
  endpoint: string
  p256dh: string
  auth: string
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: 'VAPID não configurado (secrets VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY)' }, 500)
  }

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const windowStart = new Date(now - 60 * 60 * 1000).toISOString() // janela de segurança: 1h

  // 1) Lembretes ativos, vencidos na última hora, ainda não despachados por push.
  const { data: dueRows, error } = await admin
    .from('notes')
    .select('id, title, body, owner_id, workspace_id, remind_at, pushed_at')
    .eq('status', 'active')
    .lte('remind_at', nowIso)
    .gte('remind_at', windowStart)
  if (error) return json({ error: error.message }, 500)

  const due = (dueRows as NoteRow[]).filter(
    (n) => !n.pushed_at || new Date(n.pushed_at).getTime() < new Date(n.remind_at).getTime(),
  )
  if (due.length === 0) return json({ dispatched: 0 })

  let sent = 0
  const dispatchedIds: string[] = []

  for (const note of due) {
    // 2) Alvos: dono + compartilhados (1:1) + membros do quadro.
    const targets = new Set<string>([note.owner_id])

    const { data: shares } = await admin
      .from('note_shares')
      .select('shared_with')
      .eq('note_id', note.id)
    for (const s of shares ?? []) targets.add((s as { shared_with: string }).shared_with)

    if (note.workspace_id) {
      const { data: members } = await admin
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', note.workspace_id)
      for (const m of members ?? []) targets.add((m as { user_id: string }).user_id)
    }

    // 3) Inscrições de push desses usuários.
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', [...targets])

    const payload = JSON.stringify({
      reminderId: note.id,
      title: note.title || 'Lembrete',
      body: note.body || 'Você tem um lembrete agora.',
    })

    for (const sub of (subs ?? []) as SubRow[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          // Lembrete é urgente e efêmero: entrega em até 1h ou descarta (não pipoca horas depois).
          { TTL: 60 * 60, urgency: 'high' },
        )
        sent += 1
      } catch (e) {
        // 404/410 = inscrição expirada → limpa do banco.
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }

    dispatchedIds.push(note.id)
  }

  // 4) Marca como despachado (dedup até o próximo remind_at avançar).
  if (dispatchedIds.length > 0) {
    await admin.from('notes').update({ pushed_at: nowIso }).in('id', dispatchedIds)
  }

  return json({ dispatched: dispatchedIds.length, sent })
})

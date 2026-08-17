import { supabase, VAPID_PUBLIC_KEY } from './supabase'

/**
 * Web Push (Fase 3 — app 100% fechado na PWA). Inscreve o navegador no push do fornecedor e
 * guarda a inscrição no Supabase; a Edge Function `dispatch-reminders-push` usa isso para enviar
 * o lembrete quando ele vence. Sem VAPID/SW/HTTPS, degrada (o toggle aparece indisponível).
 */

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Precisa da chave pública VAPID e de um backend Supabase para funcionar. */
export function pushConfigured(): boolean {
  return pushSupported() && !!VAPID_PUBLIC_KEY && !!supabase
}

/** Já existe uma inscrição ativa neste navegador? */
export async function isPushEnabled(): Promise<boolean> {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return !!sub
}

/** Pede permissão, inscreve e salva no Supabase. Lança em erro/negação. */
export async function enablePush(): Promise<void> {
  if (!pushConfigured()) throw new Error('Push indisponível (VAPID/HTTPS/SW).')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permissão de notificação negada.')

  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }))

  const json = sub.toJSON()
  const {
    data: { user },
  } = await supabase!.auth.getUser()
  if (!user) throw new Error('Sem sessão ativa.')

  const { error } = await supabase!
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      { onConflict: 'endpoint' },
    )
  if (error) throw error
}

/** Cancela a inscrição neste navegador e remove do Supabase. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

/** VAPID base64url → Uint8Array (formato exigido por applicationServerKey). */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

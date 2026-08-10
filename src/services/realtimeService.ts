import { supabase } from './supabase'

/**
 * Ações de tempo real além da sincronização de dados (Fase 2, RF-08 — broadcast).
 * "Disparar agora": faz o lembrete aparecer chamativo AGORA nos dispositivos das
 * pessoas informadas, via Supabase Realtime Broadcast (não depende de polling).
 * Sem Supabase (.env vazio), é no-op.
 */
export const realtimeService = {
  async fireNow(reminderId: string, userIds: string[]): Promise<void> {
    if (!supabase) return
    const targets = [...new Set(userIds)].filter(Boolean)
    await Promise.all(targets.map((uid) => sendFire(uid, reminderId)))
  },
}

/** Abre um canal efêmero no tópico do usuário-alvo, emite o evento e o fecha. */
function sendFire(uid: string, reminderId: string): Promise<void> {
  return new Promise((resolve) => {
    const ch = supabase!.channel(`sb-notas:user:${uid}`)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      void supabase!.removeChannel(ch)
      resolve()
    }
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void ch.send({ type: 'broadcast', event: 'fire', payload: { reminderId } }).finally(finish)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        finish()
      }
    })
    setTimeout(finish, 4000) // trava de segurança
  })
}

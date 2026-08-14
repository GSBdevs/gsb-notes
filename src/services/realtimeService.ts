import { supabase } from './supabase'

/**
 * Ações de tempo real além da sincronização (Fase 2, RF-08 — broadcast).
 * "Disparar agora": faz o lembrete aparecer chamativo AGORA nos dispositivos das pessoas.
 *
 * Hardening (Fase 3): em vez de o cliente abrir o canal alheio e injetar o evento, o disparo
 * passa pela RPC `broadcast_fire` (SECURITY DEFINER), que AUTORIZA no servidor (só disparo o
 * que compartilho, por share 1:1 ou por quadro) e emite via `realtime.send` no canal privado
 * do alvo. Requer a migração 0007. Sem Supabase (.env vazio), é no-op.
 */
export const realtimeService = {
  async fireNow(reminderId: string, userIds: string[]): Promise<void> {
    if (!supabase) return
    const targets = [...new Set(userIds)].filter(Boolean)
    await Promise.all(
      targets.map(async (uid) => {
        const { error } = await supabase!.rpc('broadcast_fire', {
          target_user: uid,
          reminder_id: reminderId,
        })
        // Degrada em silêncio (ex.: 0007 ainda não aplicada) — não quebra a UI.
        if (error && import.meta.env.DEV) console.debug('broadcast_fire falhou:', error.message)
      }),
    )
  },
}

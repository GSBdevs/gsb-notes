import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { useAppStore } from '@/store/useAppStore'

/**
 * Recebe "disparar agora" (Fase 2, RF-08 — broadcast). Assina o canal pessoal do
 * usuário e, ao receber um `fire`, abre o overlay chamativo do lembrete indicado.
 * Combinado com a sincronização (Postgres Changes), quem recebe já tem o lembrete
 * em cache. Sem Supabase/deslogado, não faz nada.
 */
export function useLiveTrigger() {
  const authed = useAppStore((s) => s.authed)
  const openTrigger = useAppStore((s) => s.openTrigger)

  useEffect(() => {
    if (!supabase || !authed) return
    let cancelled = false
    let channel: RealtimeChannel | null = null

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user || !supabase) return
      channel = supabase
        .channel(`sb-notas:user:${data.user.id}`)
        .on('broadcast', { event: 'fire' }, ({ payload }) => {
          const id = (payload as { reminderId?: string })?.reminderId
          if (id) openTrigger(id)
        })
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [authed, openTrigger])
}

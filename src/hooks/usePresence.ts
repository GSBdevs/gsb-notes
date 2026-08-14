import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { useAppStore } from '@/store/useAppStore'

/**
 * Presença em tempo real (Fase 3). Entra num canal de presence compartilhado, marca
 * o próprio usuário como online e mantém em `onlineIds` quem está online agora.
 * A tela Pessoas usa isso para o status "online" real. Sem Supabase/deslogado, no-op.
 */
export function usePresence() {
  const authed = useAppStore((s) => s.authed)
  const setOnlineIds = useAppStore((s) => s.setOnlineIds)

  useEffect(() => {
    if (!supabase || !authed) return
    let cancelled = false
    let channel: RealtimeChannel | null = null

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user || !supabase) return
      const uid = data.user.id
      channel = supabase.channel('sb-notas:presence', { config: { presence: { key: uid } } })
      const sync = () => setOnlineIds(Object.keys(channel!.presenceState()))
      channel
        .on('presence', { event: 'sync' }, sync)
        .on('presence', { event: 'join' }, sync)
        .on('presence', { event: 'leave' }, sync)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void channel!.track({ at: Date.now() })
        })
    })

    return () => {
      cancelled = true
      setOnlineIds([])
      if (channel && supabase) void supabase.removeChannel(channel)
    }
  }, [authed, setOnlineIds])
}

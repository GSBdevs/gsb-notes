import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAppStore } from '@/store/useAppStore'

/**
 * Sincronização em tempo real (Fase 2, RF-08). Assina as mudanças de `notes` e
 * `note_shares` (Postgres Changes, filtradas por RLS) e invalida o cache do
 * TanStack Query — o mural/pessoas se atualizam sozinhos entre dispositivos e
 * entre usuários que compartilham. No modo mock (.env vazio), não faz nada.
 */
export function useRealtimeSync() {
  const qc = useQueryClient()
  const authed = useAppStore((s) => s.authed) 

  useEffect(() => {
    if (!supabase || !authed) return
    const channel = supabase
      .channel('sb-notas-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
        qc.invalidateQueries({ queryKey: ['reminders'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_shares' }, () => {
        qc.invalidateQueries({ queryKey: ['reminders'] })
        qc.invalidateQueries({ queryKey: ['people'] })
      })
      .subscribe()

    return () => {
      void supabase!.removeChannel(channel)
    }
  }, [qc, authed])
}

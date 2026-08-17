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
      // "Visto por": alguém viu um lembrete meu → o mural reflete o recibo na hora.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_reads' }, () => {
        qc.invalidateQueries({ queryKey: ['reminders'] })
      })
      // Quadros: criação/renome/exclusão e mudança de membros refletem na hora.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => {
        qc.invalidateQueries({ queryKey: ['workspaces'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members' }, () => {
        qc.invalidateQueries({ queryKey: ['workspaces'] })
        qc.invalidateQueries({ queryKey: ['workspace-members'] })
        qc.invalidateQueries({ queryKey: ['reminders'] }) // entrar/sair muda o que vejo
      })
      // Comentários novos/apagados aparecem ao vivo em quem está com o lembrete aberto.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_comments' }, () => {
        qc.invalidateQueries({ queryKey: ['comments'] })
      })
      // Anexos idem.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'note_attachments' }, () => {
        qc.invalidateQueries({ queryKey: ['attachments'] })
      })
      .subscribe()

    return () => {
      void supabase!.removeChannel(channel)
    }
  }, [qc, authed])
}

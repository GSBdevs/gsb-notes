import { useCallback } from 'react'
import type { Reminder } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { canEditReminder } from '@/lib/reminders'

/**
 * Abre uma nota respeitando a permissão do usuário.
 * - Quem PODE editar (dono, share 'edit', membro não-viewer do quadro) vai para o editor do tipo.
 * - Quem é SÓ-VER (share 'view' ou viewer do quadro) cai no resumo read-only (ReminderViewSheet),
 *   nunca no editor — evita a "tela de editar" que depois erra ao salvar (RLS nega).
 * - Lembretes (kind 'reminder') sempre abrem no resumo; editar é ação à parte (como no mural).
 *
 * Centraliza a regra para todos os pontos de abertura (mural, tarefas, blocos, DM, notificações).
 */
export function useOpenNote() {
  const openTask = useAppStore((s) => s.openTask)
  const openBlock = useAppStore((s) => s.openBlock)
  const openView = useAppStore((s) => s.openView)
  const { data: workspaces = [] } = useWorkspaces()
  return useCallback(
    (r: Reminder) => {
      if (r.kind === 'reminder') return openView(r.id)
      if (!canEditReminder(r, workspaces)) return openView(r.id)
      if (r.kind === 'block') return openBlock(r.id)
      return openTask(r)
    },
    [openTask, openBlock, openView, workspaces],
  )
}

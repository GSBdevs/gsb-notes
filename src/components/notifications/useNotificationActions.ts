import { useCallback } from 'react'
import type { AppNotification } from '@/types'
import { useMarkNotificationRead } from '@/hooks/useNotifications'
import { useRespondContactInvite } from '@/hooks/useContactInvites'
import { useReminders } from '@/hooks/useReminders'
import { useAppStore } from '@/store/useAppStore'

/**
 * Ações compartilhadas de uma notificação: abrir (marca lida + navega para a nota) e responder
 * a um convite de contato. Usado pelo sino, pela tela de notificações e pelo toaster.
 */
export function useNotificationActions() {
  const markRead = useMarkNotificationRead()
  const respond = useRespondContactInvite()
  const { data: reminders = [] } = useReminders()
  const openView = useAppStore((s) => s.openView)
  const openTask = useAppStore((s) => s.openTask)

  const open = useCallback(
    (n: AppNotification) => {
      if (!n.read) markRead.mutate(n.id)
      if (n.noteId) {
        const r = reminders.find((x) => x.id === n.noteId)
        if (r) {
          if (r.kind === 'doc') openTask(r)
          else openView(r.id)
        }
      }
    },
    [markRead, reminders, openTask, openView],
  )

  const respondInvite = useCallback(
    (n: AppNotification, accept: boolean) => {
      const id = n.data?.invite_id as string | undefined
      if (id) respond.mutate({ id, accept })
      markRead.mutate(n.id)
    },
    [respond, markRead],
  )

  return { open, respondInvite }
}

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AppNotification } from '@/types'
import { useMarkNotificationRead } from '@/hooks/useNotifications'
import { useRespondContactInvite } from '@/hooks/useContactInvites'
import { useReminders } from '@/hooks/useReminders'
import { useOpenNote } from '@/hooks/useOpenNote'
import { notificationsService } from '@/services/notificationsService'

/**
 * Ações compartilhadas de uma notificação: abrir (marca lida + navega para a nota) e responder
 * a um convite de contato. Usado pelo sino, pela tela de notificações e pelo toaster.
 */
export function useNotificationActions() {
  const markRead = useMarkNotificationRead()
  const respond = useRespondContactInvite()
  const { data: reminders = [] } = useReminders()
  const qc = useQueryClient()
  const openNote = useOpenNote()

  const open = useCallback(
    (n: AppNotification) => {
      if (!n.read) markRead.mutate(n.id)
      if (n.noteId) {
        const r = reminders.find((x) => x.id === n.noteId)
        if (r) openNote(r)
      }
    },
    [markRead, reminders, openNote],
  )

  const respondInvite = useCallback(
    (n: AppNotification, accept: boolean) => {
      const id = n.data?.invite_id as string | undefined
      if (id) respond.mutate({ id, accept })
      const status = accept ? 'accepted' : 'declined'
      // Otimista: o botão vira "Aceito"/"Recusado" na hora e a notificação já conta como lida.
      qc.setQueryData<AppNotification[]>(['notifications'], (old) =>
        (old ?? []).map((x) =>
          x.id === n.id ? { ...x, read: true, data: { ...x.data, invite_status: status } } : x,
        ),
      )
      // Persiste o desfecho ANTES de marcar como lida (o refetch do markRead reflete os dois).
      void (async () => {
        try {
          await notificationsService.setData(n.id, { invite_status: status })
        } catch {
          /* best-effort: o otimista já mostrou o estado */
        }
        markRead.mutate(n.id) // move para a aba de lidas
      })()
    },
    [respond, markRead, qc],
  )

  return { open, respondInvite }
}

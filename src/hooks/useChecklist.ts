import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'
import type { Reminder } from '@/types'

const REMINDERS = ['reminders'] as const

/** Adiciona um item ao fim da checklist de uma tarefa (só quem edita). */
export function useAddChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, text }: { noteId: string; text: string }) =>
      notesService.addChecklistItem(noteId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: REMINDERS }),
  })
}

export function useRenameChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, text }: { itemId: string; text: string }) =>
      notesService.renameChecklistItem(itemId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: REMINDERS }),
  })
}

export function useRemoveChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => notesService.removeChecklistItem(itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: REMINDERS }),
  })
}

/**
 * Marca/desmarca um item. Liberado a qualquer um que veja a tarefa (a RPC no banco autoriza).
 * Optimistic para o toque não "piscar"; a conclusão automática vem no refetch.
 */
export function useToggleChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      notesService.toggleChecklistItem(itemId, done),
    onMutate: async ({ itemId, done }) => {
      await qc.cancelQueries({ queryKey: REMINDERS })
      const prev = qc.getQueryData<Reminder[]>(REMINDERS)
      qc.setQueryData<Reminder[]>(REMINDERS, (old = []) =>
        old.map((r) => ({
          ...r,
          checklist: r.checklist.map((c) => (c.id === itemId ? { ...c, done } : c)),
        })),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      const prev = (ctx as { prev?: Reminder[] } | undefined)?.prev
      if (prev) qc.setQueryData(REMINDERS, prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: REMINDERS }),
  })
}

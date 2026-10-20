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

/** Atribui (ou limpa) o responsável de um item de checklist. */
export function useAssignChecklistItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, userId }: { itemId: string; userId: string | null }) =>
      notesService.assignChecklistItem(itemId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: REMINDERS }),
  })
}

/** Reordena a checklist (arrastar-e-mover). Optimista para o arraste não "voltar" antes do refetch. */
export function useReorderChecklist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, orderedIds }: { noteId: string; orderedIds: string[] }) =>
      notesService.reorderChecklist(noteId, orderedIds),
    onMutate: async ({ noteId, orderedIds }) => {
      await qc.cancelQueries({ queryKey: REMINDERS })
      const prev = qc.getQueryData<Reminder[]>(REMINDERS)
      qc.setQueryData<Reminder[]>(REMINDERS, (old = []) =>
        old.map((r) => {
          if (r.id !== noteId) return r
          const byId = new Map(r.checklist.map((c) => [c.id, c]))
          const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Reminder['checklist']
          const rest = r.checklist.filter((c) => !c.id || !orderedIds.includes(c.id))
          return { ...r, checklist: [...reordered, ...rest] }
        }),
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

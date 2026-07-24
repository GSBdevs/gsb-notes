import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'
import type { Reminder, ReminderDraft, Status } from '@/types'

const KEY = ['reminders'] as const

/** Lista completa de lembretes (dados do servidor via TanStack Query). */
export function useReminders() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => notesService.listReminders(),
    staleTime: 30_000,
  })
}

/** Deriva a lista visível do mural: filtra por aba + busca, ordena fixados primeiro. */
export function selectMural(reminders: Reminder[], tab: Status, query: string): Reminder[] {
  const q = query.trim().toLowerCase()
  let list = reminders.filter((r) => r.status === tab)
  if (q) list = list.filter((r) => `${r.title} ${r.body}`.toLowerCase().includes(q))
  return list.slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
}

export function useCreateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: ReminderDraft) => notesService.createReminder(draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: ReminderDraft }) =>
      notesService.updateReminder(id, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useSetStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      notesService.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

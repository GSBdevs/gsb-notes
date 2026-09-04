import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'
import { deriveStatus, formatRemindAt } from '@/lib/reminders'
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

/**
 * Deriva a lista visível do mural: filtra por aba + busca, ordena fixados primeiro.
 * "Ativos" agrupa ativos E agendados (não são mais abas separadas); "Concluídos" = arquivados.
 */
export function selectMural(reminders: Reminder[], tab: Status, query: string): Reminder[] {
  const q = query.trim().toLowerCase()
  let list = reminders.filter((r) =>
    tab === 'archived' ? r.status === 'archived' : r.status !== 'archived',
  )
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

/** Reconstrói um rascunho a partir de um lembrete (para updates parciais como fixar). */
function toDraft(r: Reminder): ReminderDraft {
  return {
    mode: 'edit',
    id: r.id,
    title: r.title,
    body: r.body,
    color: r.color,
    priority: r.priority,
    pinned: r.pinned,
    remindAt: r.remindAt,
    recurrence: r.recurrence,
    shares: r.shares,
    tags: r.tags,
    workspaceId: r.workspaceId,
    kind: r.kind,
    checklist: r.checklist,
    ownedByMe: r.mine,
    autoSnooze: r.autoSnooze,
    snoozeIntervalMin: r.snoozeIntervalMin,
  }
}

interface OptimisticCtx {
  prev?: Reminder[]
}

/** Escreve o patch no cache imediatamente (optimistic UI) e devolve o estado anterior. */
async function applyOptimistic(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Partial<Reminder>,
): Promise<OptimisticCtx> {
  await qc.cancelQueries({ queryKey: KEY })
  const prev = qc.getQueryData<Reminder[]>(KEY)
  qc.setQueryData<Reminder[]>(KEY, (old = []) => old.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  return { prev }
}
function rollback(qc: ReturnType<typeof useQueryClient>, ctx: OptimisticCtx | undefined) {
  if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
}

export function useSetStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      notesService.setStatus(id, status),
    onMutate: ({ id, status }) => applyOptimistic(qc, id, { status }),
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Reagenda o disparo (snooze/recorrência), derivando time+status no cache na hora. */
export function useSetRemindAt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, iso }: { id: string; iso: string | null }) => notesService.setRemindAt(id, iso),
    onMutate: async ({ id, iso }): Promise<OptimisticCtx> => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<Reminder[]>(KEY)
      qc.setQueryData<Reminder[]>(KEY, (old = []) =>
        old.map((r) =>
          r.id === id
            ? {
                ...r,
                remindAt: iso,
                time: formatRemindAt(iso),
                status: r.status === 'archived' ? 'archived' : deriveStatus('active', iso),
              }
            : r,
        ),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Fixa/desafixa um lembrete (via updateReminder, sem mexer na interface do serviço). */
export function useTogglePin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (r: Reminder) =>
      notesService.updateReminder(r.id, toDraft({ ...r, pinned: !r.pinned })),
    onMutate: (r) => applyOptimistic(qc, r.id, { pinned: !r.pinned }),
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

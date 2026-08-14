import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'
import type { Perm, Person } from '@/types'

const KEY = ['people'] as const

export function usePeople() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => notesService.listPeople(),
    staleTime: 60_000,
  })
}

interface OptimisticCtx {
  prev?: Person[]
}
function rollback(qc: ReturnType<typeof useQueryClient>, ctx: OptimisticCtx | undefined) {
  if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
}

/** Muda a permissão (Ver/Editar) de uma pessoa, com aplicação imediata no cache. */
export function useUpdatePersonPerm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, perm }: { userId: string; perm: Perm }) =>
      notesService.updatePersonPerm(userId, perm),
    onMutate: async ({ userId, perm }): Promise<OptimisticCtx> => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<Person[]>(KEY)
      qc.setQueryData<Person[]>(KEY, (old = []) =>
        old.map((p) => (p.userId === userId ? { ...p, perm } : p)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Muda a permissão de uma pessoa em UM lembrete (controle por-nota). */
export function useUpdateSharePerm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, userId, perm }: { noteId: string; userId: string; perm: Perm }) =>
      notesService.updateSharePerm(noteId, userId, perm),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

/** Remove (para de compartilhar com) uma pessoa. */
export function useRemovePerson() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => notesService.removePerson(userId),
    onMutate: async (userId): Promise<OptimisticCtx> => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<Person[]>(KEY)
      qc.setQueryData<Person[]>(KEY, (old = []) => old.filter((p) => p.userId !== userId))
      return { prev }
    },
    onError: (_e, _v, ctx) => rollback(qc, ctx),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

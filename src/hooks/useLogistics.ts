import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'
import { useMyRole } from '@/hooks/useAdmin'
import { useAppStore } from '@/store/useAppStore'
import type { NewRouteInput, RouteMeta } from '@/types'

const ROUTES = ['logistics-routes'] as const
const TECHS = ['logistics-technicians'] as const
const USERS = ['logistics-users'] as const
const REMINDERS = ['reminders'] as const

/** Cidade/vaga/técnico de cada rota (lista separada de listReminders; só a Logística consulta). */
export function useRoutes(enabled = true) {
  return useQuery({ queryKey: ROUTES, queryFn: () => notesService.listRoutes(), enabled, staleTime: 30_000 })
}

export function useTechnicians(enabled = true) {
  return useQuery({ queryKey: TECHS, queryFn: () => notesService.listTechnicians(), enabled, staleTime: 60_000 })
}

/** Todos os usuários + "é técnico" (só para gerente — `enabled`). */
export function useLogisticsUsers(enabled: boolean) {
  return useQuery({ queryKey: USERS, queryFn: () => notesService.listLogisticsUsers(), enabled, staleTime: 30_000 })
}

/**
 * Quem pode o quê na Logística (doc 21 §3). Gerente = Master/Admin/Suporte. Técnico edita só a rota
 * atribuída a ele. O banco (RLS/RPCs da 0038) é a autoridade; aqui é só para mostrar/esconder controles.
 */
export function useLogisticsAccess() {
  const { data: role } = useMyRole()
  const meId = useAppStore((s) => s.userId)
  const isManager = role === 'master' || role === 'admin' || role === 'suporte'
  const canEditRoute = (meta: Pick<RouteMeta, 'technicianId'> | null | undefined) =>
    isManager || (!!meta && !!meId && meta.technicianId === meId)
  return { role, meId, isManager, canEditRoute }
}

export function useCreateRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewRouteInput) => notesService.createRoute(input),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: REMINDERS })
      qc.invalidateQueries({ queryKey: ROUTES })
    },
  })
}

export function useSetRouteTechnician() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, technicianId }: { noteId: string; technicianId: string | null }) =>
      notesService.setRouteTechnician(noteId, technicianId),
    onSettled: () => qc.invalidateQueries({ queryKey: ROUTES }),
  })
}

export function useDeleteRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) => notesService.deleteRoute(noteId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: REMINDERS })
      qc.invalidateQueries({ queryKey: ROUTES })
    },
  })
}

export function useSetTechnician() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, on }: { userId: string; on: boolean }) => notesService.setTechnician(userId, on),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: USERS })
      qc.invalidateQueries({ queryKey: TECHS })
    },
  })
}

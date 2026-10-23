import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'
import { route, type LatLon } from '@/services/geoService'
import { useReminders } from '@/hooks/useReminders'
import type { Reminder, ServiceCall } from '@/types'

const KEY = ['service-calls'] as const

/** Chamado completo: a nota (título, checklist, status, shares…) + os dados de `service_calls`. */
export interface CallItem {
  note: Reminder
  call: ServiceCall
}

/** Dados vazios de um chamado (nota kind 'call' ainda sem linha em service_calls). */
export function emptyCall(noteId: string): ServiceCall {
  return {
    noteId,
    customer: '',
    address: '',
    cep: null,
    lat: null,
    lon: null,
    geoSource: null,
    callType: 'corretiva',
    scheduledDate: null,
    technicianId: null,
    routePosition: 0,
    estMinutes: 45,
    equipment: null,
    serialNumber: null,
    meterBw: null,
    meterColor: null,
    toner: null,
  }
}

/** Lista separada de listReminders: só a aba Rotas consulta (não pesa o resto do app). */
export function useServiceCalls() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => notesService.listServiceCalls(),
    staleTime: 30_000,
  })
}

/** Junta as notas kind 'call' com os dados de cada chamado. */
export function useCalls(): { items: CallItem[]; isLoading: boolean } {
  const { data: reminders = [], isLoading: l1 } = useReminders()
  const { data: calls = [], isLoading: l2 } = useServiceCalls()
  const items = useMemo(() => {
    const byId = new Map(calls.map((c) => [c.noteId, c]))
    return reminders
      .filter((r) => r.kind === 'call')
      .map((note) => ({ note, call: byId.get(note.id) ?? emptyCall(note.id) }))
  }, [reminders, calls])
  return { items, isLoading: l1 || l2 }
}

export function useSaveServiceCall() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (call: ServiceCall) => notesService.saveServiceCall(call),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Reordena uma rota (técnico + dia) com aplicação imediata no cache. */
export function useReorderRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderedNoteIds: string[]) => notesService.reorderRoute(orderedNoteIds),
    onMutate: async (orderedNoteIds) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<ServiceCall[]>(KEY)
      const pos = new Map(orderedNoteIds.map((id, i) => [id, i]))
      qc.setQueryData<ServiceCall[]>(KEY, (old = []) =>
        old.map((c) => (pos.has(c.noteId) ? { ...c, routePosition: pos.get(c.noteId)! } : c)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** Traçado (OSRM) de uma sequência de pontos. Cacheado pela sequência exata — reordenar refaz. */
export function useRouteGeometry(points: LatLon[]) {
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join(';')
  return useQuery({
    queryKey: ['route-geometry', key],
    queryFn: () => route(points),
    enabled: points.length >= 2,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  })
}

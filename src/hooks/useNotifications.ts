import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsService } from '@/services/notificationsService'
import { useAppStore } from '@/store/useAppStore'

const KEY = ['notifications'] as const

/**
 * Notificações do usuário (sino da topbar). Atualiza ao vivo via useRealtimeSync; além disso,
 * faz um refetch de rede a cada 60s MESMO em segundo plano (`refetchIntervalInBackground`) — assim,
 * com o app escondido na bandeja (Windows), o `DesktopNotifier` ainda pega as novas e dispara o
 * toast do SO, mesmo se o websocket do realtime tiver caído enquanto a janela estava oculta.
 */
export function useNotifications() {
  const authed = useAppStore((s) => s.authed)
  return useQuery({
    queryKey: KEY,
    queryFn: () => notificationsService.list(),
    enabled: authed,
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

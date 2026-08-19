import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'
import { useAppStore } from '@/store/useAppStore'

const KEY = ['contact-invites'] as const

/** Convites de contato pendentes (enviados e recebidos). */
export function useContactInvites() {
  const authed = useAppStore((s) => s.authed)
  return useQuery({
    queryKey: KEY,
    queryFn: () => notesService.listContactInvites(),
    enabled: authed,
    staleTime: 30_000,
  })
}

/** Envia um convite por e-mail (ou aceita um convite reverso já pendente). */
export function useSendContactInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => notesService.sendContactInvite(email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['people'] })
    },
  })
}

/** Aceita (cria contato bidirecional) ou recusa um convite recebido. */
export function useRespondContactInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      notesService.respondContactInvite(id, accept),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['people'] })
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dmService } from '@/services/dmService'
import { useAppStore } from '@/store/useAppStore'
import type { NoteKind } from '@/types'

const CONV_KEY = ['dm-conversations'] as const
const msgKey = (id: string) => ['dm-messages', id] as const

interface SendInput {
  conversationId: string
  body: string
  replyToId?: string | null
  noteRef?: { id: string; kind: NoteKind; title: string } | null
}

/** Inbox de conversas (atualiza ao vivo via useRealtimeSync + polling de rede em 2º plano). */
export function useConversations() {
  const authed = useAppStore((s) => s.authed)
  return useQuery({
    queryKey: CONV_KEY,
    queryFn: () => dmService.listConversations(),
    enabled: authed,
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  })
}

/** Mensagens de uma conversa (null = nenhuma aberta). */
export function useMessages(conversationId: string | null) {
  const authed = useAppStore((s) => s.authed)
  return useQuery({
    queryKey: msgKey(conversationId ?? ''),
    queryFn: () => dmService.listMessages(conversationId as string),
    enabled: authed && !!conversationId,
    staleTime: 5_000,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SendInput) => dmService.sendMessage(input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: msgKey(v.conversationId) })
      qc.invalidateQueries({ queryKey: CONV_KEY })
    },
  })
}

/** Envia uma figurinha na conversa. */
export function useSendSticker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, stickerPath }: { conversationId: string; stickerPath: string }) =>
      dmService.sendSticker(conversationId, stickerPath),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: msgKey(v.conversationId) })
      qc.invalidateQueries({ queryKey: CONV_KEY })
    },
  })
}

/** Abre/começa a conversa com alguém → devolve o id da conversa. */
export function useStartConversation() {
  return useMutation({
    mutationFn: (peerId: string) => dmService.getOrCreateConversation(peerId),
  })
}

export function useMarkDmRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => dmService.markRead(conversationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONV_KEY }),
  })
}

/** Total de mensagens não-lidas (badge da navegação). */
export function useDmUnread(): number {
  const { data = [] } = useConversations()
  return data.reduce((sum, c) => sum + c.unread, 0)
}

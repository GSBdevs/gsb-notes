import { useEffect, useRef } from 'react'
import { useConversations } from '@/hooks/useDm'
import { useAppStore } from '@/store/useAppStore'
import { platform } from '@/platform'

/**
 * Notificação de mensagens diretas (DM). As DMs não passam pela caixa do sino (não criam
 * `notifications`), então o `DesktopNotifier` não as cobre — este componente faz o papel delas:
 * quando o nº de não-lidas de uma conversa AUMENTA (mensagem nova do outro; as minhas não contam),
 * dispara a notificação do SO (app na bandeja/sem foco) OU um toast in-app (app em foco).
 * Vale igual no Windows e no Android (ambos implementam `platform.notify`).
 */
export function DmNotifier() {
  const authed = useAppStore((s) => s.authed)
  const showToast = useAppStore((s) => s.showToast)
  const { data: conversations = [] } = useConversations()
  const prevUnread = useRef<Map<string, number>>(new Map())
  const primed = useRef(false)

  useEffect(() => {
    if (!authed) return
    // 1ª carga: só registra o estado atual (não notifica o histórico).
    if (!primed.current) {
      conversations.forEach((c) => prevUnread.current.set(c.id, c.unread))
      primed.current = true
      return
    }

    const focused = typeof document !== 'undefined' && document.hasFocus()
    for (const c of conversations) {
      const before = prevUnread.current.get(c.id) ?? 0
      if (c.unread > before) {
        const who = c.peerName.split(' ')[0]
        const body = c.lastPreview || 'Nova mensagem'
        if (focused) showToast(`${who}: ${body}`)
        else platform.notify(`Mensagem de ${who}`, body)
      }
      prevUnread.current.set(c.id, c.unread)
    }
  }, [conversations, authed, showToast])

  return null
}

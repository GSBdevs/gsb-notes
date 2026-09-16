import { useEffect, useRef } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { useAppStore } from '@/store/useAppStore'
import { platform } from '@/platform'

/**
 * Notificações do SO (área de trabalho) para as notificações do app (sino). Pede permissão ao
 * logar e, quando chega uma notificação NOVA, dispara uma notificação nativa via `platform.notify`
 * — mas só quando a janela NÃO está em foco (com o app à frente, o toaster in-app já cobre; evita
 * notificar em dobro). Espelha a detecção de "novo" do NotificationToaster (prime na 1ª carga).
 */
export function DesktopNotifier() {
  const authed = useAppStore((s) => s.authed)
  const { data: notifications = [] } = useNotifications()
  const seen = useRef<Set<string>>(new Set())
  const primed = useRef(false)

  // Pede permissão de notificação uma vez, ao logar (best-effort; silencioso se negar).
  useEffect(() => {
    if (!authed) return
    void platform.requestNotificationPermission().catch(() => {})
  }, [authed])

  useEffect(() => {
    if (!authed) return
    if (!primed.current) {
      notifications.forEach((n) => seen.current.add(n.id))
      primed.current = true
      return
    }
    const fresh = notifications.filter((n) => !seen.current.has(n.id) && !n.read)
    if (fresh.length === 0) return
    fresh.forEach((n) => seen.current.add(n.id))

    // Com o app em foco, o toaster in-app já mostra — evita duplicar na área de trabalho.
    const focused = typeof document !== 'undefined' && document.hasFocus()
    if (focused) return

    for (const n of fresh.slice(0, 3)) {
      const who = n.actorName ? `${n.actorName.split(' ')[0]} ` : ''
      const title = 'SB Notas'
      const body = `${who}${n.body}${n.title ? ` “${n.title}”` : ''}`.trim()
      platform.notify(title, body)
    }
  }, [notifications, authed])

  return null
}

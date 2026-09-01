import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AppNotification } from '@/types'
import { useNotifications } from '@/hooks/useNotifications'
import { useAppStore } from '@/store/useAppStore'
import { useNotificationActions } from '@/components/notifications/useNotificationActions'
import { TYPE_ICON } from '@/components/notifications/NotificationRow'
import { Icon } from '@/components/ui/Icon'

/** Tempo que cada card fica na tela antes de sumir (ms). */
const DURATION = 5200

/**
 * Toaster de notificações (estilo Windows): quando chega uma notificação NOVA, mostra um card no
 * canto superior direito por alguns segundos e some. Detecta o "novo" comparando com o que já foi
 * visto — na primeira carga marca o histórico como visto para não disparar toasts em lote.
 */
export function NotificationToaster() {
  const authed = useAppStore((s) => s.authed)
  const { data: notifications = [] } = useNotifications()
  const { open } = useNotificationActions()
  const [toasts, setToasts] = useState<AppNotification[]>([])
  const seen = useRef<Set<string>>(new Set())
  const primed = useRef(false)

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
    setToasts((prev) => [...fresh, ...prev].slice(0, 3))
  }, [notifications, authed])

  const dismiss = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id))

  if (!authed || toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[330px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((n) => (
          <ToastCard
            key={n.id}
            n={n}
            onOpen={(x) => {
              open(x)
              dismiss(x.id)
            }}
            onClose={() => dismiss(n.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastCard({
  n,
  onOpen,
  onClose,
}: {
  n: AppNotification
  onOpen: (n: AppNotification) => void
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, DURATION)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 44, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 44, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => onOpen(n)}
      className="pointer-events-auto flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-bg-elevated p-3 shadow-pop backdrop-blur-sm"
    >
      <span
        className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-full text-[12px] font-bold text-[#0A0A0B]"
        style={{ background: n.actorColor }}
      >
        {n.actorAvatar ? (
          <img src={n.actorAvatar} alt="" className="h-full w-full object-cover" />
        ) : (
          n.actorInitials
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-text-primary">
          <span className="font-semibold">{n.actorName.split(' ')[0]}</span> {n.body}
          {n.title && <span className="font-medium text-text-secondary"> “{n.title}”</span>}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-muted">
          <Icon name={TYPE_ICON[n.type] ?? 'bell'} size={11} />
          Agora
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Dispensar"
        className="grid h-6 w-6 flex-none place-items-center rounded text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text-primary"
      >
        <Icon name="x" size={14} />
      </button>
    </motion.div>
  )
}

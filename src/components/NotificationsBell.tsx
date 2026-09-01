import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useMarkAllNotificationsRead, useNotifications } from '@/hooks/useNotifications'
import { useNotificationActions } from '@/components/notifications/useNotificationActions'
import { NotificationRow } from '@/components/notifications/NotificationRow'
import { Icon } from '@/components/ui/Icon'

/** Quantas lidas mostrar no sino (o resto fica na tela cheia). */
const READ_PREVIEW = 6

export function NotificationsBell() {
  const { data: notifications = [] } = useNotifications()
  const markAll = useMarkAllNotificationsRead()
  const { open, respondInvite } = useNotificationActions()
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.read)
  const read = notifications.filter((n) => n.read)

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [isOpen])

  const openNote = (n: Parameters<typeof open>[0]) => {
    setIsOpen(false)
    open(n)
  }

  const seeAll = () => {
    setIsOpen(false)
    navigate('/notificacoes')
  }

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notificações"
        title="Notificações"
        className="relative grid h-9 w-9 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
      >
        <Icon name="bell" size={19} />
        {unread.length > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-bold text-[#0A0A0B]"
            style={{ background: 'var(--accent)' }}
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-11 z-20 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-border bg-bg-elevated shadow-pop"
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Notificações</span>
              <div className="flex-1" />
              {unread.length > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-[12px] font-semibold text-accent hover:text-accent-hover"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <Icon name="bell" size={24} style={{ color: 'var(--text-muted)' }} />
                  <p className="text-[13px] text-text-muted">Nenhuma notificação por aqui.</p>
                </div>
              ) : (
                <>
                  {unread.length > 0 && (
                    <>
                      <SectionLabel>Não lidas · {unread.length}</SectionLabel>
                      <div className="divide-y divide-border">
                        {unread.map((n) => (
                          <NotificationRow key={n.id} n={n} onOpen={openNote} onRespondInvite={respondInvite} />
                        ))}
                      </div>
                    </>
                  )}
                  {read.length > 0 && (
                    <>
                      <SectionLabel>Lidas</SectionLabel>
                      <div className="divide-y divide-border">
                        {read.slice(0, READ_PREVIEW).map((n) => (
                          <NotificationRow key={n.id} n={n} onOpen={openNote} onRespondInvite={respondInvite} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <button
              onClick={seeAll}
              className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-[12.5px] font-semibold text-accent transition-colors hover:bg-bg-elevated-2"
            >
              Ver todas as notificações
              <Icon name="chevron-right" size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-elevated px-4 pb-1.5 pt-2.5 text-[11px] font-semibold uppercase tracking-[.05em] text-text-muted">
      {children}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { AppNotification, NotificationType } from '@/types'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications'
import { useRespondContactInvite } from '@/hooks/useContactInvites'
import { useReminders } from '@/hooks/useReminders'
import { useAppStore } from '@/store/useAppStore'
import { formatRemindAt } from '@/lib/reminders'
import { Icon } from '@/components/ui/Icon'

/** Ícone por tipo de notificação. */
const TYPE_ICON: Record<NotificationType, string> = {
  note_shared: 'share-2',
  note_created: 'bell-plus',
  note_edited: 'pencil',
  task_completed: 'check-circle',
  checklist_item_done: 'list-todo',
  contact_invite: 'user-plus',
  contact_accepted: 'users',
}

export function NotificationsBell() {
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const respond = useRespondContactInvite()
  const { data: reminders = [] } = useReminders()
  const openView = useAppStore((s) => s.openView)
  const openTask = useAppStore((s) => s.openTask)

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.read).length

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const onClickNotification = (n: AppNotification) => {
    if (!n.read) markRead.mutate(n.id)
    if (n.noteId) {
      const r = reminders.find((x) => x.id === n.noteId)
      if (r) {
        setOpen(false)
        if (r.kind === 'doc') openTask(r)
        else openView(r.id)
      }
    }
  }

  const respondInvite = (n: AppNotification, accept: boolean) => {
    const id = n.data?.invite_id as string | undefined
    if (id) respond.mutate({ id, accept })
    markRead.mutate(n.id)
  }

  return (
    <div ref={ref} className="relative flex-none">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificações"
        title="Notificações"
        className="relative grid h-9 w-9 place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
      >
        <Icon name="bell" size={19} />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full px-1 text-[10px] font-bold text-[#0A0A0B]"
            style={{ background: 'var(--accent)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
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
              {unread > 0 && (
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
                notifications.map((n) => {
                  const isInvite = n.type === 'contact_invite'
                  return (
                    <div
                      key={n.id}
                      onClick={() => !isInvite && onClickNotification(n)}
                      className={`flex gap-2.5 border-b border-border px-4 py-3 last:border-b-0 ${
                        isInvite ? '' : 'cursor-pointer'
                      } ${n.read ? '' : 'bg-accent-surface/40'} transition-colors hover:bg-bg-elevated-2`}
                    >
                      <span
                        className="mt-0.5 grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-full text-[11px] font-bold text-[#0A0A0B]"
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
                          {n.title && (
                            <>
                              {' '}
                              <span className="font-medium text-text-secondary">“{n.title}”</span>
                            </>
                          )}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-muted">
                          <Icon name={TYPE_ICON[n.type] ?? 'bell'} size={11} />
                          {formatRemindAt(n.createdAt)}
                        </div>
                        {isInvite && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                respondInvite(n, true)
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12.5px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
                            >
                              <Icon name="check" size={13} /> Aceitar
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                respondInvite(n, false)
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                            >
                              Recusar
                            </button>
                          </div>
                        )}
                      </div>
                      {!n.read && !isInvite && (
                        <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: 'var(--accent)' }} />
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

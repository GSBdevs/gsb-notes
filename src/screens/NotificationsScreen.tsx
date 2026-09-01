import { useState } from 'react'
import { useMarkAllNotificationsRead, useNotifications } from '@/hooks/useNotifications'
import { useNotificationActions } from '@/components/notifications/useNotificationActions'
import { NotificationRow } from '@/components/notifications/NotificationRow'
import { groupNotificationsByDay } from '@/lib/notifications'
import { Icon } from '@/components/ui/Icon'

type Filter = 'all' | 'unread'

/** Tela cheia de notificações — histórico organizado por dia, com filtro lidas/não-lidas. */
export function NotificationsScreen() {
  const { data: notifications = [], isLoading } = useNotifications()
  const markAll = useMarkAllNotificationsRead()
  const { open, respondInvite } = useNotificationActions()
  const [filter, setFilter] = useState<Filter>('all')

  const unreadCount = notifications.filter((n) => !n.read).length
  const list = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications
  const groups = groupNotificationsByDay(list)

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterChip label="Todas" count={notifications.length} on={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterChip label="Não lidas" count={unreadCount} on={filter === 'unread'} onClick={() => setFilter('unread')} />
        <div className="flex-1" />
        {unreadCount > 0 && (
          <button
            onClick={() => markAll.mutate()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Icon name="check" size={14} /> Marcar todas como lidas
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="px-1 py-10 text-sm text-text-muted">Carregando notificações…</p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
          <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-bg-elevated text-text-muted">
            <Icon name="bell" size={26} />
          </div>
          <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">
            {filter === 'unread' ? 'Nada não lido' : 'Nenhuma notificação'}
          </h3>
          <p className="max-w-[340px] text-sm">
            Você é avisado quando compartilham, editam ou concluem algo com você, e quando alguém te
            convida.
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.label} className="mb-5">
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
              {g.label}
            </h3>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-bg-elevated">
              {g.items.map((n) => (
                <NotificationRow key={n.id} n={n} onOpen={open} onRespondInvite={respondInvite} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function FilterChip({
  label,
  count,
  on,
  onClick,
}: {
  label: string
  count: number
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] transition-colors ${
        on
          ? 'border-accent bg-accent font-semibold text-text-on-accent'
          : 'border-border bg-bg-elevated font-medium text-text-secondary hover:border-border-strong'
      }`}
    >
      {label}
      <span className="text-xs font-bold" style={{ color: on ? 'rgba(10,10,11,.55)' : 'var(--text-muted)' }}>
        {count}
      </span>
    </button>
  )
}

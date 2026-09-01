import type { AppNotification, NotificationType } from '@/types'
import { formatRemindAt } from '@/lib/reminders'
import { Icon } from '@/components/ui/Icon'

/** Ícone por tipo de notificação. */
export const TYPE_ICON: Record<NotificationType, string> = {
  note_shared: 'share-2',
  note_created: 'bell-plus',
  note_edited: 'pencil',
  task_completed: 'check-circle',
  checklist_item_done: 'list-todo',
  contact_invite: 'user-plus',
  contact_accepted: 'users',
}

interface Props {
  n: AppNotification
  onOpen: (n: AppNotification) => void
  onRespondInvite: (n: AppNotification, accept: boolean) => void
  /** Mostra um ponto/realce quando não lida. */
  showUnreadDot?: boolean
}

/** Uma linha de notificação — reusada no sino, na tela cheia e no toaster. */
export function NotificationRow({ n, onOpen, onRespondInvite, showUnreadDot = true }: Props) {
  const isInvite = n.type === 'contact_invite'
  return (
    <div
      onClick={() => !isInvite && onOpen(n)}
      className={`flex gap-2.5 px-4 py-3 transition-colors ${isInvite ? '' : 'cursor-pointer'} ${
        n.read ? '' : 'bg-accent-surface/40'
      } hover:bg-bg-elevated-2`}
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
                onRespondInvite(n, true)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[12.5px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
            >
              <Icon name="check" size={13} /> Aceitar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRespondInvite(n, false)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              Recusar
            </button>
          </div>
        )}
      </div>
      {showUnreadDot && !n.read && !isInvite && (
        <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: 'var(--accent)' }} />
      )}
    </div>
  )
}

import type { Priority, Share } from '@/types'
import { AvatarStack, PriorityBadge } from './ui/primitives'
import { Icon } from './ui/Icon'

/** Ação rápida exibida no hover/foco do card (padrão Google Keep). */
export interface CardAction {
  icon: string
  label: string
  onClick: () => void
  tone?: 'default' | 'accent'
}

interface CardViewProps {
  color: string
  title: string
  body: string
  priority: Priority
  pinned: boolean
  time: string
  shares: Pick<Share, 'initials' | 'color'>[]
  onClick?: () => void
  clampBody?: boolean
  actions?: CardAction[]
}

/** Card presentacional — usado no mural e na prévia ao vivo do editor. */
export function ReminderCardView({
  color,
  title,
  body,
  priority,
  pinned,
  time,
  shares,
  onClick,
  clampBody = true,
  actions,
}: CardViewProps) {
  const interactive = Boolean(onClick)
  const hasActions = Boolean(actions && actions.length > 0)
  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={`group relative rounded-lg border border-border bg-bg-elevated p-4 pb-3.5 transition-all duration-150 ${
        interactive
          ? 'cursor-pointer hover:-translate-y-px hover:border-border-strong hover:bg-bg-elevated-2 hover:shadow-pop'
          : ''
      }`}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      {hasActions && (
        <div className="card-actions absolute right-2 top-2 z-[1] flex items-center gap-0.5 rounded-md border border-border bg-bg-elevated-2/95 p-1 shadow-pop backdrop-blur-sm">
          {actions!.map((a) => (
            <button
              key={a.label}
              type="button"
              title={a.label}
              aria-label={a.label}
              onClick={(e) => {
                e.stopPropagation()
                a.onClick()
              }}
              className={`grid h-7 w-7 place-items-center rounded transition-colors hover:bg-bg-elevated ${
                a.tone === 'accent'
                  ? 'text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon name={a.icon} size={15} />
            </button>
          ))}
        </div>
      )}
      <div className="mb-1.5 flex items-start gap-2">
        <h3 className="flex-1 text-[15px] font-semibold leading-tight tracking-[-.01em]">
          {title}
        </h3>
        {pinned && (
          <Icon name="pin" size={15} style={{ color: 'var(--accent)', transform: 'rotate(35deg)' }} />
        )}
      </div>
      <p
        className={`mb-3 text-[13.5px] leading-normal text-text-secondary ${
          clampBody ? 'line-clamp-4' : ''
        }`}
      >
        {body}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={priority} />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
          <Icon name="clock" size={12} />
          {time}
        </span>
        {shares.length > 0 && (
          <>
            <div className="flex-1" />
            <AvatarStack shares={shares} />
          </>
        )}
      </div>
    </div>
  )
}

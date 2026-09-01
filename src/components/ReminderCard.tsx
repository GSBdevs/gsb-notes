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
  shares: Pick<Share, 'initials' | 'color' | 'avatarUrl'>[]
  tags?: string[]
  onClick?: () => void
  clampBody?: boolean
  actions?: CardAction[]
  /** Sou o dono? Só então mostramos o recibo "visto por" dos destinatários. */
  mine?: boolean
  /** Quantos destinatários já viram (para o badge "visto por"). */
  seenCount?: number
  /** Nome de quem criou — exibido quando o lembrete NÃO é meu ("por Fulano"). */
  ownerName?: string
  ownerColor?: string
  ownerAvatar?: string | null
  /** 'cards' (masonry, padrão) ou 'list' (linha compacta). */
  layout?: 'cards' | 'list'
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
  tags = [],
  onClick,
  clampBody = true,
  actions,
  mine = false,
  seenCount = 0,
  ownerName,
  ownerColor = '#94A3B8',
  ownerAvatar,
  layout = 'cards',
}: CardViewProps) {
  const interactive = Boolean(onClick)
  const hasActions = Boolean(actions && actions.length > 0)
  const showReceipts = mine && shares.length > 0

  // ── Linha compacta (visualização em lista) ──
  if (layout === 'list') {
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
        className={`group flex items-center gap-3 rounded-lg border border-border bg-bg-elevated px-3.5 py-2.5 transition-all duration-150 ${
          interactive ? 'cursor-pointer hover:border-border-strong hover:bg-bg-elevated-2' : ''
        }`}
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold leading-tight tracking-[-.01em]">
              {title}
            </h3>
            {pinned && (
              <Icon name="pin" size={13} style={{ color: 'var(--accent)', transform: 'rotate(35deg)' }} />
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-text-muted">
            <PriorityBadge priority={priority} size={11} />
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" size={11} />
              {time}
            </span>
            {!mine && ownerName && <span>por {ownerName.split(' ')[0]}</span>}
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="text-text-muted">
                #{t}
              </span>
            ))}
          </div>
        </div>
        {showReceipts && (
          <span
            title={seenCount > 0 ? `Visto por ${seenCount} de ${shares.length}` : 'Ninguém viu ainda'}
            className="inline-flex flex-none items-center gap-1 text-xs font-semibold"
            style={{ color: seenCount > 0 ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            <Icon name="eye" size={12} />
            {seenCount}/{shares.length}
          </span>
        )}
        {shares.length > 0 && <AvatarStack shares={shares} />}
        {hasActions && (
          <div className="card-actions flex flex-none items-center gap-0.5">
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
                  a.tone === 'accent' ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon name={a.icon} size={15} />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

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
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-0.5 rounded-full bg-bg-elevated-2 px-2 py-0.5 text-[11.5px] font-medium text-text-secondary"
            >
              <span className="text-text-muted">#</span>
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={priority} />
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text-muted">
          <Icon name="clock" size={12} />
          {time}
        </span>
        {/* Criado por outra pessoa → identifica o autor. */}
        {!mine && ownerName && (
          <span className="inline-flex items-center gap-1 rounded-full bg-bg-elevated-2 py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-text-secondary">
            <span
              className="grid h-4 w-4 place-items-center overflow-hidden rounded-full text-[8px] font-bold text-[#0A0A0B]"
              style={{ background: ownerColor }}
            >
              {ownerAvatar ? (
                <img src={ownerAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                ownerName.trim().charAt(0).toUpperCase()
              )}
            </span>
            por {ownerName.split(' ')[0]}
          </span>
        )}
        {shares.length > 0 && (
          <>
            <div className="flex-1" />
            {showReceipts && (
              <span
                title={
                  seenCount > 0
                    ? `Visto por ${seenCount} de ${shares.length}`
                    : 'Ninguém viu ainda'
                }
                className="inline-flex items-center gap-1 text-xs font-semibold"
                style={{ color: seenCount > 0 ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                <Icon name="eye" size={12} />
                {seenCount}/{shares.length}
              </span>
            )}
            <AvatarStack shares={shares} />
          </>
        )}
      </div>
    </div>
  )
}

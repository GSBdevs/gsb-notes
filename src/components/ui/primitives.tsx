import type { Priority, Share } from '@/types'
import { PRIORITIES, tint } from '@/lib/constants'
import { Icon } from './Icon'

/** Avatar circular com iniciais. `presence` adiciona um ponto de status. */
export function Avatar({
  initials,
  color,
  size = 30,
  presence,
  ringColor = 'var(--bg-elevated)',
}: {
  initials: string
  color: string
  size?: number
  presence?: 'online' | 'offline'
  ringColor?: string
}) {
  return (
    <span
      className="relative grid place-items-center rounded-full font-bold text-[#0A0A0B]"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
    >
      {initials}
      {presence && (
        <span
          className="absolute rounded-full"
          style={{
            bottom: -1,
            right: -1,
            width: 11,
            height: 11,
            border: `2px solid ${ringColor}`,
            background: presence === 'online' ? 'var(--success)' : 'var(--text-muted)',
          }}
        />
      )}
    </span>
  )
}

/** Pilha de avatares sobrepostos (compartilhamento). */
export function AvatarStack({
  shares,
  size = 22,
  ring = 'var(--bg-elevated)',
}: {
  shares: Pick<Share, 'initials' | 'color'>[]
  size?: number
  ring?: string
}) {
  return (
    <div className="flex items-center">
      {shares.map((s, i) => (
        <span
          key={i}
          className="grid place-items-center rounded-full font-bold text-[#0A0A0B]"
          style={{
            width: size,
            height: size,
            background: s.color,
            fontSize: size * 0.45,
            marginLeft: i === 0 ? 0 : -6,
            border: `2px solid ${ring}`,
          }}
        >
          {s.initials}
        </span>
      ))}
    </div>
  )
}

/** Chip de prioridade (some quando 'normal'). */
export function PriorityBadge({ priority, size = 11.5 }: { priority: Priority; size?: number }) {
  if (priority === 'normal') return null
  const p = PRIORITIES[priority]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full font-semibold"
      style={{ fontSize: size, padding: '3px 9px', color: p.color, background: tint(p.color) }}
    >
      <Icon name={p.icon} size={12} />
      {p.label}
    </span>
  )
}

/** Toggle on/off (usado em Fixar e nos Ajustes). */
export function Toggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onChange}
      className="relative flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        width: 44,
        height: 26,
        background: checked ? 'var(--accent)' : 'var(--border-strong)',
      }}
    >
      <span
        className="absolute rounded-full transition-all"
        style={{
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          background: checked ? 'var(--text-on-accent)' : 'var(--text-primary)',
        }}
      />
    </button>
  )
}

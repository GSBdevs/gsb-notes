import type { ReactNode } from 'react'
import type { Reminder } from '@/types'
import type { GeneralGroup } from '@/lib/generalGroups'
import { tint } from '@/lib/constants'
import { Icon } from '@/components/ui/Icon'

/** Faixa colorida do quadro no Geral: nome + cor do quadro + contagem. */
export function WorkspaceBand({ ws, count }: { ws: NonNullable<GeneralGroup['workspace']>; count: number }) {
  return (
    <div
      className="mb-3 flex items-center gap-2.5 rounded-md px-3.5 py-2"
      style={{ background: tint(ws.color, '1a'), borderLeft: `4px solid ${ws.color}` }}
    >
      <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: ws.color }} />
      <span className="text-[13.5px] font-bold tracking-[-.01em]" style={{ color: ws.color }}>
        {ws.name}
      </span>
      <span className="text-xs font-semibold text-text-muted">{count}</span>
    </div>
  )
}

/** Cabeçalho de grupo por origem (Pessoais / Compartilhados / Outros quadros) no Geral. */
export function GroupLabel({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
      <Icon name={icon} size={14} />
      {label}
      <span className="font-bold">{count}</span>
    </div>
  )
}

/** Estado vazio da visão Geral (só leitura, sem botão de criar). Reutilizado por tarefas/blocos. */
export function GeneralEmptyKind({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
      <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-accent-surface text-accent-ink">
        <Icon name={icon} size={28} />
      </div>
      <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">{title}</h3>
      <p className="max-w-[350px] text-sm">{text}</p>
    </div>
  )
}

/**
 * Renderiza a visão agregada do Geral: uma seção por grupo (faixa do quadro ou rótulo de origem)
 * seguida dos cards. Cada tela fornece seu próprio `renderCards` (recebe os itens e a cor do quadro
 * para sobrepor a cor própria dos cards, quando o grupo é de um quadro).
 */
export function GeneralGroupedView({
  groups,
  renderCards,
}: {
  groups: GeneralGroup[]
  renderCards: (items: Reminder[], colorOverride?: string) => ReactNode
}) {
  return (
    <div className="flex flex-col gap-7">
      {groups.map((g) => (
        <section key={g.key}>
          {g.workspace ? (
            <WorkspaceBand ws={g.workspace} count={g.items.length} />
          ) : (
            <GroupLabel icon={g.icon!} label={g.label!} count={g.items.length} />
          )}
          {renderCards(g.items, g.workspace?.color)}
        </section>
      ))}
    </div>
  )
}

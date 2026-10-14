import { useMemo, useState, type ReactNode } from 'react'
import type { Reminder, Workspace } from '@/types'
import type { CompletedSort } from '@/store/useAppStore'
import { useAppStore } from '@/store/useAppStore'
import { buildGeneralGroups } from '@/lib/generalGroups'
import { tint } from '@/lib/constants'
import { Icon } from '@/components/ui/Icon'

const SORTS: { key: CompletedSort; label: string }[] = [
  { key: 'recent', label: 'Mais recentes' },
  { key: 'old', label: 'Mais antigos' },
  { key: 'az', label: 'A–Z' },
]

/** Comparador da aba Concluídos. Data = `completedAt` (0031) quando houver; senão `order` (≈ criação). */
function sortFn(sort: CompletedSort) {
  return (a: Reminder, b: Reminder) => {
    if (sort === 'az') return a.title.localeCompare(b.title, 'pt-BR')
    const ka = a.completedAt ? new Date(a.completedAt).getTime() : a.order
    const kb = b.completedAt ? new Date(b.completedAt).getTime() : b.order
    return sort === 'old' ? ka - kb : kb - ka
  }
}

/**
 * Aba "Concluídos" (lembretes OU tarefas): controle de ordenação + itens agrupados por pasta em
 * seções COLAPSÁVEIS — para muitos concluídos não poluírem a tela e ficar mais simples procurar.
 * Reusa `buildGeneralGroups` (Compartilhados → Pessoais → uma seção por pasta). Cada tela passa seu
 * próprio `renderCards` (com as ações/leitura que já usa).
 */
export function CompletedView({
  items,
  workspaces,
  renderCards,
}: {
  items: Reminder[]
  workspaces: Workspace[]
  renderCards: (items: Reminder[]) => ReactNode
}) {
  const sort = useAppStore((s) => s.completedSort)
  const setSort = useAppStore((s) => s.setCompletedSort)

  const groups = useMemo(
    () => buildGeneralGroups(items.slice().sort(sortFn(sort)), workspaces),
    [items, workspaces, sort],
  )

  // Muitas seções → recolhidas por padrão (tela compacta); seção única → já aberta.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const [touched, setTouched] = useState(false)
  const defaultOpen = groups.length <= 1
  const isOpen = (key: string) => (touched ? openKeys.has(key) : defaultOpen)
  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const base = touched ? prev : new Set(defaultOpen ? groups.map((g) => g.key) : [])
      const next = new Set(base)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setTouched(true)
  }

  return (
    <div>
      {/* Ordenação */}
      <div className="mb-4 flex items-center gap-2">
        <Icon name="arrow-up-down" size={14} style={{ color: 'var(--text-muted)' }} />
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-elevated p-0.5">
          {SORTS.map((o) => {
            const on = sort === o.key
            return (
              <button
                key={o.key}
                onClick={() => setSort(o.key)}
                aria-pressed={on}
                className={`inline-flex h-7 items-center rounded px-2.5 text-[12.5px] font-medium transition-colors ${
                  on ? 'bg-accent-surface text-accent-ink' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Seções colapsáveis por pasta/origem */}
      <div className="flex flex-col gap-3">
        {groups.map((g) => {
          const open = isOpen(g.key)
          const ws = g.workspace
          return (
            <section key={g.key}>
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={open}
                className="flex w-full items-center gap-2.5 rounded-md px-3.5 py-2 text-left transition-colors"
                style={
                  ws
                    ? { background: tint(ws.color, '1a'), borderLeft: `4px solid ${ws.color}` }
                    : { background: 'var(--bg-elevated)', border: '1px solid var(--border)' }
                }
              >
                <Icon
                  name="chevron-right"
                  size={15}
                  className="flex-none transition-transform"
                  style={{ transform: open ? 'rotate(90deg)' : 'none', color: ws ? ws.color : 'var(--text-muted)' }}
                />
                {!ws && g.icon && <Icon name={g.icon} size={14} style={{ color: 'var(--text-muted)' }} />}
                <span
                  className="text-[13.5px] font-bold tracking-[-.01em]"
                  style={{ color: ws ? ws.color : 'var(--text-secondary)' }}
                >
                  {ws ? ws.name : g.label}
                </span>
                <span className="text-xs font-semibold text-text-muted">{g.items.length}</span>
              </button>
              {open && <div className="mt-3">{renderCards(g.items)}</div>}
            </section>
          )
        })}
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import type { City, Reminder, RouteMeta, RouteSlot } from '@/types'
import { useAppStore, type CompletedSort } from '@/store/useAppStore'
import { useReminders } from '@/hooks/useReminders'
import { useLogisticsAccess, useLogisticsUsers, useRoutes, useSetTechnician } from '@/hooks/useLogistics'
import { CITIES, CITY_LABEL, SLOT_LABEL } from '@/lib/logistics'
import { initialsFromName } from '@/lib/constants'
import { Avatar, Toggle } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

type Tab = 'active' | 'archived'

/** Rota completa: a nota (título, checklist, status) + cidade/vaga/técnico. */
interface RouteItem {
  note: Reminder
  meta: RouteMeta
}

const SORTS: { key: CompletedSort; label: string }[] = [
  { key: 'recent', label: 'Mais recentes' },
  { key: 'old', label: 'Mais antigos' },
  { key: 'az', label: 'A–Z' },
]

/**
 * Logística (doc 21) — liberada para TODOS (30/10): todos veem; Master/Admin/Suporte gerenciam e o
 * técnico edita só a rota dele (o banco garante). Três quadros fixos (Serra,
 * Vitória, Vila Velha/Cariacica), cada um com uma vaga de Rota do dia e uma de Pré-Rota. Rotas são
 * tarefas (mesmo modal, em modo rota). Ao concluir a Rota do dia, o banco move os itens ✗ para a
 * Pré-Rota e a promove a Rota do dia (gatilho da 0038). Concluídos: por cidade → técnico.
 */
export function LogisticsScreen() {
  return <LogisticsInner />
}

function LogisticsInner() {
  const { data: reminders = [], isLoading: l1 } = useReminders()
  const { data: metas = [], isLoading: l2 } = useRoutes()
  const access = useLogisticsAccess()
  const openRoute = useAppStore((s) => s.openRoute)
  const [tab, setTab] = useState<Tab>('active')
  const [techOpen, setTechOpen] = useState(false)

  const items: RouteItem[] = useMemo(() => {
    const byId = new Map(reminders.filter((r) => r.kind === 'route').map((r) => [r.id, r]))
    return metas.flatMap((meta) => {
      const note = byId.get(meta.noteId)
      return note ? [{ note, meta }] : []
    })
  }, [reminders, metas])

  const active = items.filter((i) => i.meta.slot !== 'concluida')
  const done = items.filter((i) => i.meta.slot === 'concluida')
  const slotOf = (city: City, slot: RouteSlot) => active.find((i) => i.meta.city === city && i.meta.slot === slot) ?? null

  const open = (i: RouteItem) =>
    openRoute(i.note, { city: i.meta.city, slot: i.meta.slot, technicianId: i.meta.technicianId })
  const create = (city: City, slot: 'rota' | 'pre_rota') => openRoute(null, { city, slot, technicianId: null })

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: 'Ativos', count: active.length },
    { key: 'archived', label: 'Concluídos', count: done.length },
  ]

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const on = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] transition-colors ${
                on
                  ? 'border-accent bg-accent font-semibold text-text-on-accent'
                  : 'border-border bg-bg-elevated font-medium text-text-secondary hover:border-border-strong'
              }`}
            >
              {t.label}
              <span className="text-xs font-bold" style={{ color: on ? 'rgba(10,10,11,.55)' : 'var(--text-muted)' }}>
                {t.count}
              </span>
            </button>
          )
        })}
        <div className="flex-1" />
        {access.isManager && (
          <button
            onClick={() => setTechOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Icon name="users" size={15} /> Técnicos
          </button>
        )}
      </div>

      {l1 || l2 ? (
        <p className="px-1 py-10 text-sm text-text-muted">Carregando rotas…</p>
      ) : tab === 'active' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {CITIES.map((city) => (
            <section key={city} className="rounded-lg border border-border bg-bg-surface p-3">
              <h2 className="mb-3 flex items-center gap-2 px-1 text-[15px] font-semibold">
                <Icon name="route" size={16} style={{ color: 'var(--accent)' }} />
                {CITY_LABEL[city]}
              </h2>
              <div className="flex flex-col gap-3">
                {(['rota', 'pre_rota'] as const).map((slot) => {
                  const it = slotOf(city, slot)
                  return (
                    <div key={slot}>
                      <div className="mb-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-[.06em] text-text-muted">
                        {SLOT_LABEL[slot]}
                      </div>
                      {it ? (
                        <RouteCard item={it} onOpen={() => open(it)} />
                      ) : access.isManager ? (
                        <button
                          onClick={() => create(city, slot)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-5 text-[13px] font-semibold text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
                        >
                          <Icon name="plus" size={15} /> {slot === 'rota' ? 'Nova Rota' : 'Nova Pré-Rota'}
                        </button>
                      ) : (
                        <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-[13px] text-text-muted">
                          Sem {slot === 'rota' ? 'rota' : 'pré-rota'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <CompletedRoutes items={done} onOpen={open} />
      )}

      {techOpen && <TechniciansModal onClose={() => setTechOpen(false)} />}
    </>
  )
}

/** Card da rota (base visual do card de Tarefas): título, técnico, progresso ✓/✗ e prévia dos itens. */
function RouteCard({ item: { note, meta }, onOpen }: { item: RouteItem; onOpen: () => void }) {
  const total = note.checklist.length
  const resolved = note.checklist.filter((c) => c.done).length
  const failed = note.checklist.filter((c) => c.done && c.failed).length
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="cursor-pointer rounded-lg border border-border bg-bg-elevated p-3.5 transition-colors hover:border-border-strong hover:bg-bg-elevated-2"
      style={{ borderLeft: `4px solid ${meta.technicianColor ?? 'var(--border-strong)'}` }}
    >
      <h3 className="mb-1.5 min-w-0 break-words text-[14.5px] font-semibold leading-tight">{note.title}</h3>
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] text-text-secondary">
        {meta.technicianName ? (
          <>
            <Avatar
              initials={initialsFromName(meta.technicianName)}
              color={meta.technicianColor ?? '#94A3B8'}
              src={meta.technicianAvatar ?? undefined}
              size={20}
            />
            <span className="truncate">{meta.technicianName}</span>
          </>
        ) : (
          <span className="text-text-muted">Sem técnico</span>
        )}
      </div>
      {total > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {note.checklist.slice(0, 4).map((c, i) => (
            <div key={c.id ?? i} className="flex items-start gap-2 text-[13px]">
              <span
                className={`mt-[3px] grid h-3.5 w-3.5 flex-none place-items-center rounded-full border ${
                  !c.done
                    ? 'border-border-strong'
                    : c.failed
                      ? 'border-danger bg-danger text-white'
                      : 'border-success bg-success text-[#0A0A0B]'
                }`}
              >
                {c.done && <Icon name={c.failed ? 'x' : 'check'} size={9} strokeWidth={3.5} />}
              </span>
              <span className={`min-w-0 break-words ${c.done ? 'text-text-muted line-through' : 'text-text-secondary'}`}>
                {c.text}
              </span>
            </div>
          ))}
          {total > 4 && <span className="pl-[22px] text-[12px] text-text-muted">+{total - 4} itens…</span>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-text-muted">
        {total > 0 ? (
          <span className="inline-flex items-center gap-1" style={{ color: resolved === total ? 'var(--success)' : undefined }}>
            <Icon name="check-circle" size={12} /> {resolved}/{total}
          </span>
        ) : (
          <span>Sem itens</span>
        )}
        {failed > 0 && (
          <span className="inline-flex items-center gap-1 text-danger">
            <Icon name="x" size={12} /> {failed} não {failed === 1 ? 'feito' : 'feitos'}
          </span>
        )}
      </div>
    </div>
  )
}

/** Concluídos: filtros (cidade, técnico) + ordenação, agrupados por cidade → técnico. */
function CompletedRoutes({ items, onOpen }: { items: RouteItem[]; onOpen: (i: RouteItem) => void }) {
  const sort = useAppStore((s) => s.completedSort)
  const setSort = useAppStore((s) => s.setCompletedSort)
  const [city, setCity] = useState<City | 'all'>('all')
  const [tech, setTech] = useState<string>('all')

  const techs = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of items) m.set(i.meta.technicianId ?? 'none', i.meta.technicianName ?? 'Sem técnico')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [items])

  const when = (i: RouteItem) => (i.note.completedAt ? new Date(i.note.completedAt).getTime() : i.note.order)
  const list = items
    .filter((i) => city === 'all' || i.meta.city === city)
    .filter((i) => tech === 'all' || (i.meta.technicianId ?? 'none') === tech)
    .sort((a, b) =>
      sort === 'az' ? a.note.title.localeCompare(b.note.title, 'pt-BR') : sort === 'old' ? when(a) - when(b) : when(b) - when(a),
    )

  const chip = (on: boolean) =>
    `h-8 rounded-full border px-3 text-[12.5px] transition-colors ${
      on ? 'border-accent bg-accent-surface font-semibold text-accent-ink' : 'border-border bg-bg-elevated font-medium text-text-secondary hover:border-border-strong'
    }`

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className={chip(city === 'all')} onClick={() => setCity('all')}>
          Todas as cidades
        </button>
        {CITIES.map((c) => (
          <button key={c} className={chip(city === c)} onClick={() => setCity(c)}>
            {CITY_LABEL[c]}
          </button>
        ))}
        <select
          value={tech}
          onChange={(e) => setTech(e.target.value)}
          aria-label="Filtrar por técnico"
          className="h-8 rounded-full border border-border bg-bg-elevated px-3 text-[12.5px] font-medium text-text-secondary outline-none focus:border-border-strong"
        >
          <option value="all">Todos os técnicos</option>
          {techs.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as CompletedSort)}
          aria-label="Ordenar"
          className="h-8 rounded-full border border-border bg-bg-elevated px-3 text-[12.5px] font-medium text-text-secondary outline-none focus:border-border-strong"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <p className="px-1 py-10 text-center text-sm text-text-muted">Nenhuma rota concluída com esses filtros.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {CITIES.filter((c) => list.some((i) => i.meta.city === c)).map((c) => {
            const ofCity = list.filter((i) => i.meta.city === c)
            const groups = new Map<string, RouteItem[]>()
            for (const i of ofCity) {
              const k = i.meta.technicianName ?? 'Sem técnico'
              groups.set(k, [...(groups.get(k) ?? []), i])
            }
            return (
              <section key={c}>
                <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
                  <Icon name="route" size={16} style={{ color: 'var(--accent)' }} />
                  {CITY_LABEL[c]}
                  <span className="text-[12px] font-bold text-text-muted">{ofCity.length}</span>
                </h2>
                <div className="flex flex-col gap-4">
                  {[...groups.entries()]
                    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
                    .map(([name, rs]) => (
                      <div key={name}>
                        <div className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-[.06em] text-text-muted">
                          {name} · {rs.length}
                        </div>
                        <div className="grid-cards">
                          {rs.map((i) => (
                            <div key={i.note.id}>
                              <RouteCard item={i} onOpen={() => onOpen(i)} />
                              {i.note.completedAt && (
                                <div className="mt-1 px-1 text-[11px] text-text-muted">
                                  Concluída em {new Date(i.note.completedAt).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}

/** Gerente liga/desliga quem é técnico (só técnicos aparecem no seletor da rota). */
function TechniciansModal({ onClose }: { onClose: () => void }) {
  const { data: users = [], isLoading } = useLogisticsUsers(true)
  const setTech = useSetTechnician()
  return (
    <Modal title="Técnicos" onClose={onClose}>
      <div className="flex flex-col gap-1.5 p-5">
        <p className="mb-2 text-[12.5px] text-text-muted">
          Técnicos veem todas as rotas e editam só a rota atribuída a eles.
        </p>
        {isLoading ? (
          <p className="py-6 text-sm text-text-muted">Carregando…</p>
        ) : (
          users.map((u) => (
            <div key={u.userId} className="flex items-center gap-3 rounded-md border border-border bg-bg-elevated px-3 py-2.5">
              <Avatar initials={initialsFromName(u.name)} color={u.color} src={u.avatarUrl ?? undefined} size={32} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{u.name}</span>
              <Toggle
                checked={u.isTechnician}
                disabled={setTech.isPending}
                onChange={() => setTech.mutate({ userId: u.userId, on: !u.isTechnician })}
              />
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}

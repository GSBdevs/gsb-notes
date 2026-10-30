import { useMemo, useState } from 'react'
import type { City, LogisticsBoard, Reminder, RouteMeta, RouteSlot } from '@/types'
import { useAppStore, type CompletedSort } from '@/store/useAppStore'
import { useReminders } from '@/hooks/useReminders'
import {
  useBoards,
  useCreateBoard,
  useDeleteBoard,
  useLogisticsAccess,
  useLogisticsUsers,
  useRoutes,
  useSetTechnician,
} from '@/hooks/useLogistics'
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

/** Chave do "lugar" da rota: cidade fixa ou card extra (0040). */
const placeKey = (m: Pick<RouteMeta, 'city' | 'boardId'>) => m.city ?? `b:${m.boardId}`

/**
 * Logística (doc 21) — liberada para TODOS (30/10): todos veem; Master/Admin/Suporte gerenciam e o
 * técnico (não-gerente) vê e edita SÓ a Rota do dia dele (0040). Três quadros fixos (Serra, Vitória,
 * Vila Velha/Cariacica/Viana), cada um com Rota do dia + Pré-Rota, e cards extras (só nome, uma rota). Rotas são
 * tarefas (mesmo modal, em modo rota). Ao concluir a Rota do dia, o banco move os itens ✗ para a
 * Pré-Rota e a promove a Rota do dia (gatilho da 0038). Concluídos: por cidade → técnico.
 */
export function LogisticsScreen() {
  return <LogisticsInner />
}

function LogisticsInner() {
  const { data: reminders = [], isLoading: l1 } = useReminders()
  const { data: metas = [], isLoading: l2 } = useRoutes()
  const { data: boards = [] } = useBoards()
  const access = useLogisticsAccess()
  const openRoute = useAppStore((s) => s.openRoute)
  const showToast = useAppStore((s) => s.showToast)
  const deleteBoard = useDeleteBoard()
  const [tab, setTab] = useState<Tab>('active')
  const [techOpen, setTechOpen] = useState(false)
  const [boardOpen, setBoardOpen] = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const items: RouteItem[] = useMemo(() => {
    const byId = new Map(reminders.filter((r) => r.kind === 'route').map((r) => [r.id, r]))
    return metas.flatMap((meta) => {
      const note = byId.get(meta.noteId)
      return note ? [{ note, meta }] : []
    })
  }, [reminders, metas])

  const activeBoards = boards.filter((b) => !b.archived)
  const placeName = (key: string) =>
    key.startsWith('b:') ? (boards.find((b) => `b:${b.id}` === key)?.name ?? 'Card excluído') : CITY_LABEL[key as City]

  const active = items.filter((i) => i.meta.slot !== 'concluida')
  const done = items.filter((i) => i.meta.slot === 'concluida')
  const slotOf = (key: string, slot: RouteSlot) =>
    active.find((i) => placeKey(i.meta) === key && i.meta.slot === slot) ?? null

  const open = (i: RouteItem) =>
    openRoute(i.note, {
      city: i.meta.city,
      boardId: i.meta.boardId,
      slot: i.meta.slot,
      technicianId: i.meta.technicianId,
    })
  const createIn = (place: { city: City | null; boardId: string | null }, slot: 'rota' | 'pre_rota') =>
    openRoute(null, { ...place, slot, technicianId: null })

  const removeBoard = (b: LogisticsBoard) => {
    if (confirmDel !== b.id) {
      setConfirmDel(b.id)
      setTimeout(() => setConfirmDel((c) => (c === b.id ? null : c)), 3500)
      return
    }
    setConfirmDel(null)
    deleteBoard.mutate(b.id, {
      onSuccess: () => showToast('Card excluído'),
      onError: () => showToast('Não foi possível excluir o card'),
    })
  }

  // Técnico (não-gerente): vê só a Rota do dia dele (o banco já filtra — 0040).
  const myRoutes = active.filter((i) => i.meta.slot === 'rota')

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'active', label: access.isTechnicianOnly ? 'Minha rota' : 'Ativos', count: access.isTechnicianOnly ? myRoutes.length : active.length },
    { key: 'archived', label: 'Concluídos', count: done.length },
  ]

  /** Uma vaga (Rota do dia / Pré-Rota) de um lugar. */
  const renderSlot = (key: string, place: { city: City | null; boardId: string | null }, slot: 'rota' | 'pre_rota') => {
    const it = slotOf(key, slot)
    return (
      <div key={slot}>
        <div className="mb-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-[.06em] text-text-muted">
          {place.boardId ? 'Rota' : SLOT_LABEL[slot]}
        </div>
        {it ? (
          <RouteCard item={it} onOpen={() => open(it)} />
        ) : access.isManager ? (
          <button
            onClick={() => createIn(place, slot)}
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
  }

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
          <>
            <button
              onClick={() => setBoardOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <Icon name="plus" size={15} /> Novo card
            </button>
            <button
              onClick={() => setTechOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <Icon name="users" size={15} /> Técnicos
            </button>
          </>
        )}
      </div>

      {l1 || l2 ? (
        <p className="px-1 py-10 text-sm text-text-muted">Carregando rotas…</p>
      ) : tab === 'archived' ? (
        <CompletedRoutes items={done} onOpen={open} placeName={placeName} boards={boards} />
      ) : access.isTechnicianOnly ? (
        <MyRoutes items={myRoutes} placeName={placeName} onOpen={open} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {CITIES.map((city) => (
            <section key={city} className="rounded-lg border border-border bg-bg-surface p-3">
              <h2 className="mb-3 flex items-center gap-2 px-1 text-[15px] font-semibold">
                <Icon name="route" size={16} style={{ color: 'var(--accent)' }} />
                {CITY_LABEL[city]}
              </h2>
              <div className="flex flex-col gap-3">
                {(['rota', 'pre_rota'] as const).map((slot) => renderSlot(city, { city, boardId: null }, slot))}
              </div>
            </section>
          ))}
          {/* Cards extras (0040): só nome, UMA rota, sem Pré-Rota. Quem criou pode excluir. */}
          {activeBoards.map((b) => (
            <section key={b.id} className="rounded-lg border border-border bg-bg-surface p-3">
              <h2 className="mb-3 flex items-center gap-2 px-1 text-[15px] font-semibold">
                <Icon name="route" size={16} style={{ color: 'var(--accent)' }} />
                <span className="min-w-0 flex-1 break-words">{b.name}</span>
                {b.createdBy === access.meId && (
                  <button
                    onClick={() => removeBoard(b)}
                    title={confirmDel === b.id ? 'Confirmar exclusão' : 'Excluir card'}
                    aria-label="Excluir card"
                    className={`grid h-7 w-7 flex-none place-items-center rounded transition-colors ${
                      confirmDel === b.id ? 'text-danger' : 'text-text-muted hover:text-danger'
                    }`}
                  >
                    <Icon name={confirmDel === b.id ? 'check' : 'trash-2'} size={15} />
                  </button>
                )}
              </h2>
              {renderSlot(`b:${b.id}`, { city: null, boardId: b.id }, 'rota')}
            </section>
          ))}
        </div>
      )}

      {techOpen && <TechniciansModal onClose={() => setTechOpen(false)} />}
      {boardOpen && <NewBoardModal onClose={() => setBoardOpen(false)} />}
    </>
  )
}

/**
 * Visão do TÉCNICO: só a Rota do dia dele, em destaque (pensado no celular) — lugar, título, anotações
 * e TODOS os itens visíveis com letra maior; um botão grande abre a rota para marcar ✓/✗.
 */
function MyRoutes({
  items,
  placeName,
  onOpen,
}: {
  items: RouteItem[]
  placeName: (key: string) => string
  onOpen: (i: RouteItem) => void
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-5 py-16 text-center text-text-secondary">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent-surface text-accent-ink">
          <Icon name="route" size={26} />
        </div>
        <h3 className="mb-1 text-[17px] font-semibold text-text-primary">Nenhuma rota para você agora</h3>
        <p className="max-w-[300px] text-sm">Quando o Suporte/Admin definir sua rota do dia, ela aparece aqui.</p>
      </div>
    )
  }
  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5">
      {items.map((i) => {
        const total = i.note.checklist.length
        const resolved = i.note.checklist.filter((c) => c.done).length
        return (
          <article key={i.note.id} className="rounded-xl border-2 border-accent bg-bg-elevated p-4 shadow-pop sm:p-5">
            <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[.05em] text-accent-ink">
              <Icon name="route" size={15} /> {placeName(placeKey(i.meta))} · Rota do dia
            </div>
            <h2 className="mb-2 break-words text-[21px] font-bold leading-tight">{i.note.title}</h2>
            {i.note.body && (
              <p className="mb-3 whitespace-pre-wrap break-words rounded-md bg-bg-base px-3.5 py-3 text-[15px] leading-relaxed text-text-secondary">
                {i.note.body}
              </p>
            )}
            {total > 0 && (
              <>
                <div className="mb-2 text-[13px] font-semibold text-text-muted">
                  {resolved}/{total} {total === 1 ? 'item resolvido' : 'itens resolvidos'}
                </div>
                <ol className="mb-4 flex flex-col gap-2">
                  {i.note.checklist.map((c, idx) => (
                    <li
                      key={c.id ?? idx}
                      className="flex items-start gap-3 rounded-md border border-border bg-bg-base px-3.5 py-3 text-[16px] leading-snug"
                    >
                      <span
                        className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full border-2 text-[12px] font-bold ${
                          !c.done
                            ? 'border-border-strong text-text-muted'
                            : c.failed
                              ? 'border-danger bg-danger text-white'
                              : 'border-success bg-success text-[#0A0A0B]'
                        }`}
                      >
                        {c.done ? <Icon name={c.failed ? 'x' : 'check'} size={14} strokeWidth={3} /> : idx + 1}
                      </span>
                      <span className={`min-w-0 flex-1 whitespace-pre-wrap break-words ${c.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                        {c.text}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <button
              onClick={() => onOpen(i)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[16px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
            >
              <Icon name="check-circle" size={18} /> Abrir e marcar itens
            </button>
          </article>
        )
      })}
    </div>
  )
}

/** Cria um card extra — só o nome. */
function NewBoardModal({ onClose }: { onClose: () => void }) {
  const create = useCreateBoard()
  const showToast = useAppStore((s) => s.showToast)
  const [name, setName] = useState('')
  const save = () => {
    if (!name.trim()) return
    create.mutate(name.trim(), {
      onSuccess: () => {
        showToast('Card criado')
        onClose()
      },
      onError: () => showToast('Não foi possível criar o card'),
    })
  }
  return (
    <Modal
      title="Novo card"
      onClose={onClose}
      footer={
        <>
          <div className="flex-1" />
          <button
            onClick={save}
            disabled={!name.trim() || create.isPending}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Icon name="check" size={15} /> Criar card
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-2 p-5">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-text-muted">Nome do card</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Ex.: Guarapari"
            className="h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong"
          />
        </label>
        <p className="text-[12px] text-text-muted">O card tem uma rota só (sem Pré-Rota). Só você poderá excluí-lo.</p>
      </div>
    </Modal>
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
function CompletedRoutes({
  items,
  onOpen,
  placeName,
  boards,
}: {
  items: RouteItem[]
  onOpen: (i: RouteItem) => void
  placeName: (key: string) => string
  boards: LogisticsBoard[]
}) {
  const sort = useAppStore((s) => s.completedSort)
  const setSort = useAppStore((s) => s.setCompletedSort)
  const [city, setCity] = useState<string>('all') // cidade ou `b:<card>`
  // Lugares na ordem: cidades fixas, depois cards (inclusive excluídos que têm histórico).
  const places = [
    ...CITIES,
    ...boards.map((b) => `b:${b.id}`).filter((k) => items.some((i) => placeKey(i.meta) === k)),
  ]
  const [tech, setTech] = useState<string>('all')

  const techs = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of items) m.set(i.meta.technicianId ?? 'none', i.meta.technicianName ?? 'Sem técnico')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [items])

  const when = (i: RouteItem) => (i.note.completedAt ? new Date(i.note.completedAt).getTime() : i.note.order)
  const list = items
    .filter((i) => city === 'all' || placeKey(i.meta) === city)
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
        {places.map((c) => (
          <button key={c} className={chip(city === c)} onClick={() => setCity(c)}>
            {placeName(c)}
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
          {places.filter((c) => list.some((i) => placeKey(i.meta) === c)).map((c) => {
            const ofCity = list.filter((i) => placeKey(i.meta) === c)
            const groups = new Map<string, RouteItem[]>()
            for (const i of ofCity) {
              const k = i.meta.technicianName ?? 'Sem técnico'
              groups.set(k, [...(groups.get(k) ?? []), i])
            }
            return (
              <section key={c}>
                <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
                  <Icon name="route" size={16} style={{ color: 'var(--accent)' }} />
                  {placeName(c)}
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

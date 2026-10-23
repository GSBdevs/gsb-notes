import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { arrayMove } from '@dnd-kit/sortable'
import { useAppStore } from '@/store/useAppStore'
import { useMyRole } from '@/hooks/useAdmin'
import { usePeople } from '@/hooks/usePeople'
import { useCalls, useReorderRoute, useRouteGeometry, type CallItem } from '@/hooks/useServiceCalls'
import { geocode, mapsUrlTo, mapsUrlsForRoute, wazeUrlTo, type LatLon } from '@/services/geoService'
import { NO_TECH_COLOR, addClock, addDays, callTypeLabel, dayLabel, fmtDistance, fmtDuration, todayIso } from '@/lib/routes'
import { SortableCards } from '@/components/dnd/SortableCards'
import { CallEditor, type Technician } from '@/components/routes/CallEditor'
import { RouteMap, type MapRoute } from '@/components/routes/RouteMap'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

type Tab = 'active' | 'archived'
/** Dia da rota ou a fila "A agendar" (chamados sem dia). */
type DayKey = string | 'unscheduled'

/** Rota de um técnico num dia: chamados na ordem. */
interface RouteGroup {
  key: string
  technicianId: string | null
  name: string
  color: string
  items: CallItem[]
}

const byRoute = (a: CallItem, b: CallItem) =>
  a.call.routePosition - b.call.routePosition || b.note.order - a.note.order

const hasLoc = (c: CallItem) => c.call.lat != null && c.call.lon != null

/**
 * Rotas — logística de técnicos de impressora (FERRAMENTA DE TESTE: só a conta master).
 * Chamados (notas kind 'call' + service_calls) agrupados por técnico no dia, ordenados à mão
 * (arrastar), com mapa (pins numerados + traçado OSRM), ETA e "abrir no Maps". Escopo: doc 19.
 */
export function RoutesScreen() {
  const { data: myRole, isLoading: roleLoading } = useMyRole()
  if (roleLoading) return <p className="px-1 py-10 text-sm text-text-muted">Carregando…</p>
  if (myRole !== 'master') return <Navigate to="/" replace />
  return <RoutesInner />
}

function RoutesInner() {
  const { items, isLoading } = useCalls()
  const { data: people = [] } = usePeople()
  const meId = useAppStore((s) => s.userId)
  const profile = useAppStore((s) => s.profile)
  const routeBase = useAppStore((s) => s.routeBase)
  const routeStart = useAppStore((s) => s.routeStart)
  const reorder = useReorderRoute()

  const [day, setDay] = useState<DayKey>(todayIso())
  const [tech, setTech] = useState<string>('all')
  const [tab, setTab] = useState<Tab>('active')
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<null | { id: string | null }>(null)
  const [baseOpen, setBaseOpen] = useState(false)

  // Técnicos possíveis: eu + meus contatos (usuários reais — vale para a liberação, doc 19 §10).
  const technicians: Technician[] = useMemo(() => {
    const list: Technician[] = []
    if (meId) list.push({ userId: meId, name: `${profile.name} (você)`, color: profile.color })
    for (const p of people) if (p.userId !== meId) list.push({ userId: p.userId, name: p.name, color: p.color })
    return list
  }, [people, meId, profile.name, profile.color])
  const techOf = (id: string | null) => technicians.find((t) => t.userId === id)

  const inTab = items.filter((c) => (tab === 'archived' ? c.note.status === 'archived' : c.note.status !== 'archived'))
  const inTech = inTab.filter((c) => tech === 'all' || (tech === 'none' ? !c.call.technicianId : c.call.technicianId === tech))
  const unscheduledCount = items.filter((c) => c.note.status !== 'archived' && !c.call.scheduledDate).length
  const visible =
    tab === 'archived'
      ? inTech
      : inTech.filter((c) => (day === 'unscheduled' ? !c.call.scheduledDate : c.call.scheduledDate === day))

  // Uma rota por técnico (ordem de rota dentro de cada uma).
  const groups: RouteGroup[] = (() => {
    const map = new Map<string, RouteGroup>()
    for (const c of visible) {
      const key = c.call.technicianId ?? 'none'
      if (!map.has(key)) {
        const t = techOf(c.call.technicianId)
        map.set(key, {
          key,
          technicianId: c.call.technicianId,
          name: t?.name ?? (c.call.technicianId ? 'Técnico' : 'Sem técnico'),
          color: t?.color ?? NO_TECH_COLOR,
          items: [],
        })
      }
      map.get(key)!.items.push(c)
    }
    const list = [...map.values()]
    list.forEach((g) => g.items.sort(byRoute))
    return list.sort((a, b) => (a.technicianId ? 0 : 1) - (b.technicianId ? 0 : 1) || a.name.localeCompare(b.name))
  })()

  const mapRoutes: MapRoute[] = groups.map((g) => ({
    key: g.key,
    color: g.color,
    stops: g.items.filter(hasLoc).map((c, i) => ({
      id: c.note.id,
      lat: c.call.lat!,
      lon: c.call.lon!,
      n: i + 1,
      title: c.call.customer || c.note.title,
      done: c.note.status === 'archived',
    })),
  }))

  /** Fim da rota (técnico + dia) — para chamado novo ou que mudou de rota. */
  const nextPosition = (technicianId: string | null, d: string | null) =>
    items
      .filter((c) => c.call.technicianId === technicianId && c.call.scheduledDate === d)
      .reduce((max, c) => Math.max(max, c.call.routePosition + 1), 0)

  const doReorder = (g: RouteGroup, from: number, to: number) =>
    reorder.mutate(arrayMove(g.items, from, to).map((c) => c.note.id))

  // Clicar no pin destaca e rola até o card (no mobile, volta para a lista).
  const selectFromMap = (id: string) => {
    setSelectedId(id)
    setMobileView('list')
    requestAnimationFrame(() => document.getElementById(`call-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const editingItem = editing?.id ? (items.find((c) => c.note.id === editing.id) ?? null) : null
  // O chamado em edição sumiu (excluído em outro aparelho) → fecha.
  useEffect(() => {
    if (editing?.id && !isLoading && !editingItem) setEditing(null)
  }, [editing, editingItem, isLoading])

  const realDay = day === 'unscheduled' ? null : day

  return (
    <>
      {/* Barra: dia + técnico + base */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-full border border-border bg-bg-elevated">
          <button
            aria-label="Dia anterior"
            onClick={() => setDay(addDays(realDay ?? todayIso(), -1))}
            className="grid h-9 w-9 place-items-center text-text-secondary hover:text-text-primary"
          >
            <Icon name="arrow-left" size={15} />
          </button>
          <label className="relative cursor-pointer px-1 text-[13.5px] font-semibold">
            {day === 'unscheduled' ? 'A agendar' : dayLabel(day)}
            <input
              type="date"
              aria-label="Escolher dia"
              value={realDay ?? ''}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <button
            aria-label="Próximo dia"
            onClick={() => setDay(addDays(realDay ?? todayIso(), 1))}
            className="grid h-9 w-9 place-items-center text-text-secondary hover:text-text-primary"
          >
            <Icon name="arrow-left" size={15} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
        {day !== todayIso() && (
          <button onClick={() => setDay(todayIso())} className="h-9 rounded-full border border-border bg-bg-elevated px-3.5 text-[13px] font-medium text-text-secondary hover:border-border-strong">
            Hoje
          </button>
        )}
        <button
          onClick={() => setDay(day === 'unscheduled' ? todayIso() : 'unscheduled')}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
            day === 'unscheduled'
              ? 'border-accent bg-accent font-semibold text-text-on-accent'
              : 'border-border bg-bg-elevated text-text-secondary hover:border-border-strong'
          }`}
        >
          A agendar <span className="text-xs font-bold opacity-70">{unscheduledCount}</span>
        </button>
        <select
          value={tech}
          onChange={(e) => setTech(e.target.value)}
          aria-label="Filtrar por técnico"
          className="h-9 rounded-full border border-border bg-bg-elevated px-3 text-[13px] font-medium text-text-secondary outline-none focus:border-border-strong"
        >
          <option value="all">Todos os técnicos</option>
          {technicians.map((t) => (
            <option key={t.userId} value={t.userId}>
              {t.name}
            </option>
          ))}
          <option value="none">Sem técnico</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setBaseOpen(true)}
          title="Ponto de partida das rotas"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3.5 text-[13px] font-medium text-text-secondary hover:border-border-strong"
        >
          <Icon name="settings" size={14} /> {routeBase ? `Base: ${routeBase.label}` : 'Definir base'} · {routeStart}
        </button>
        <button
          onClick={() => setEditing({ id: null })}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-text-on-accent hover:bg-accent-hover"
        >
          <Icon name="plus" size={15} /> Novo chamado
        </button>
      </div>

      {/* Ativos / Concluídos + alternância lista/mapa (mobile) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['active', 'Ativos'],
            ['archived', 'Concluídos'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`h-8 rounded-full border px-3 text-[13px] transition-colors ${
              tab === k
                ? 'border-accent bg-accent font-semibold text-text-on-accent'
                : 'border-border bg-bg-elevated font-medium text-text-secondary hover:border-border-strong'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="inline-flex rounded-full border border-border bg-bg-elevated p-0.5 md:hidden">
          {(
            [
              ['list', 'list', 'Lista'],
              ['map', 'map', 'Mapa'],
            ] as const
          ).map(([k, icon, label]) => (
            <button
              key={k}
              onClick={() => setMobileView(k)}
              className={`inline-flex h-7 items-center gap-1 rounded-full px-3 text-[12.5px] font-semibold ${
                mobileView === k ? 'bg-bg-elevated-2 text-text-primary' : 'text-text-muted'
              }`}
            >
              <Icon name={icon} size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        {/* Lista de rotas */}
        <div className={`flex w-full flex-col gap-5 md:w-[400px] md:flex-none ${mobileView === 'map' ? 'hidden md:flex' : ''}`}>
          {isLoading ? (
            <p className="px-1 py-10 text-sm text-text-muted">Carregando chamados…</p>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-14 text-center text-text-secondary">
              <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-accent-surface text-accent-ink">
                <Icon name="route" size={26} />
              </div>
              <h3 className="mb-1 text-[16px] font-semibold text-text-primary">
                {tab === 'archived' ? 'Nenhum chamado concluído' : 'Nenhum chamado neste dia'}
              </h3>
              <p className="max-w-[300px] text-sm">
                Crie chamados com endereço, atribua a um técnico e arraste para definir a ordem da rota.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <RouteGroupView
                key={g.key}
                group={g}
                base={routeBase}
                start={routeStart}
                showEta={tab === 'active' && day !== 'unscheduled'}
                draggable={tab === 'active'}
                selectedId={selectedId}
                onOpen={(id) => {
                  setSelectedId(id)
                  setEditing({ id })
                }}
                onReorder={(from, to) => doReorder(g, from, to)}
              />
            ))
          )}
        </div>

        {/* Mapa */}
        <div
          className={`relative h-[calc(100vh-260px)] min-h-[360px] w-full overflow-hidden rounded-lg border border-border md:sticky md:top-0 md:h-[calc(100vh-200px)] md:flex-1 ${
            mobileView === 'list' ? 'hidden md:block' : ''
          }`}
        >
          <RouteMap
            routes={tab === 'archived' ? [] : mapRoutes}
            base={routeBase}
            selectedId={selectedId}
            onSelect={selectFromMap}
          />
        </div>
      </div>

      {editing && (
        <CallEditor
          key={editing.id ?? 'new'}
          item={editingItem}
          defaults={{
            scheduledDate: realDay,
            technicianId: tech !== 'all' && tech !== 'none' ? tech : null,
          }}
          technicians={technicians}
          nextPosition={nextPosition}
          onClose={() => setEditing(null)}
        />
      )}
      {baseOpen && <BaseSheet onClose={() => setBaseOpen(false)} />}
    </>
  )
}

/** Uma rota (técnico): cabeçalho com totais + cards arrastáveis com ETA por parada. */
function RouteGroupView({
  group: g,
  base,
  start,
  showEta,
  draggable,
  selectedId,
  onOpen,
  onReorder,
}: {
  group: RouteGroup
  base: LatLon | null
  start: string
  showEta: boolean
  draggable: boolean
  selectedId: string | null
  onOpen: (id: string) => void
  onReorder: (from: number, to: number) => void
}) {
  // Mesmos pontos (e mesma chave de cache) do traçado no mapa: base + paradas pendentes com local.
  const pending = g.items.filter((c) => hasLoc(c) && c.note.status !== 'archived')
  const points: LatLon[] = [...(base ? [base] : []), ...pending.map((c) => ({ lat: c.call.lat!, lon: c.call.lon! }))]
  const { data: geo } = useRouteGeometry(showEta ? points : [])

  // ETA: saída da base às `start`; chegada = deslocamento acumulado + atendimentos anteriores.
  const eta = new Map<string, { arrive: string; leg?: { duration: number; distance: number } }>()
  let travel = 0
  let distance = 0
  let service = 0
  if (showEta && geo?.routed) {
    let clock = 0 // min desde a saída
    pending.forEach((c, i) => {
      const leg = geo.legs[base ? i : i - 1]
      if (leg) {
        clock += leg.duration / 60
        travel += leg.duration
        distance += leg.distance
      }
      eta.set(c.note.id, { arrive: base || i > 0 ? addClock(start, clock) : '', leg })
      clock += c.call.estMinutes
    })
  }
  for (const c of pending) service += c.call.estMinutes

  const stops = pending.map((c) => ({ lat: c.call.lat!, lon: c.call.lon! }))
  const routeUrls = mapsUrlsForRoute(stops, base)
  let n = 0
  const numberOf = new Map(g.items.filter(hasLoc).map((c) => [c.note.id, ++n]))

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
        <h3 className="text-[14px] font-semibold">{g.name}</h3>
        <span className="text-[12px] text-text-muted">
          {g.items.length} {g.items.length === 1 ? 'parada' : 'paradas'}
        </span>
        <div className="flex-1" />
        {routeUrls.map((url, i) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-bg-elevated px-2.5 text-[12px] font-semibold text-text-secondary hover:border-border-strong hover:text-text-primary"
          >
            <Icon name="navigation" size={12} /> {routeUrls.length > 1 ? `Rota ${i + 1}` : 'Abrir rota'}
          </a>
        ))}
      </div>
      {showEta && pending.length > 0 && (
        <p className="mb-2 px-1 text-[12px] text-text-muted">
          {geo?.routed
            ? `Deslocamento ${fmtDuration(travel)} (${fmtDistance(distance)}) + atendimento ${fmtDuration(service * 60)} = ${fmtDuration(travel + service * 60)}`
            : points.length >= 2
              ? 'Calculando trajeto… (sem resposta do servidor de rotas, o mapa mostra linha reta)'
              : `Atendimento estimado ${fmtDuration(service * 60)}`}
        </p>
      )}
      <SortableCards
        items={g.items.map((c) => ({ ...c, id: c.note.id }))}
        layout="list"
        disabled={!draggable}
        onReorder={onReorder}
        renderItem={(c) => (
          <CallCard
            item={c}
            n={numberOf.get(c.note.id) ?? null}
            color={g.color}
            eta={eta.get(c.note.id)}
            selected={c.note.id === selectedId}
            onOpen={() => onOpen(c.note.id)}
          />
        )}
      />
    </section>
  )
}

function CallCard({
  item: { note, call },
  n,
  color,
  eta,
  selected,
  onOpen,
}: {
  item: CallItem
  n: number | null
  color: string
  eta?: { arrive: string; leg?: { duration: number; distance: number } }
  selected: boolean
  onOpen: () => void
}) {
  const total = note.checklist.length
  const doneCount = note.checklist.filter((c) => c.done).length
  const done = note.status === 'archived'
  const loc = hasLoc({ note, call }) ? { lat: call.lat!, lon: call.lon! } : null
  return (
    <div
      id={`call-${note.id}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={`group relative mb-2 cursor-pointer rounded-lg border bg-bg-elevated p-3.5 transition-colors hover:border-border-strong hover:bg-bg-elevated-2 ${
        selected ? 'border-accent' : 'border-border'
      }`}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-7 w-7 flex-none place-items-center rounded-full text-[12.5px] font-bold"
          style={
            n != null && !done
              ? { background: color, color: '#0A0A0B' }
              : { background: 'var(--bg-elevated-2)', color: 'var(--text-muted)' }
          }
          title={n == null ? 'Sem localização' : undefined}
        >
          {n ?? '?'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h4 className={`min-w-0 flex-1 break-words text-[14.5px] font-semibold leading-tight ${done ? 'text-text-muted line-through' : ''}`}>
              {call.customer || note.title}
            </h4>
            {eta?.arrive && <span className="flex-none text-[12.5px] font-bold text-accent-ink">~{eta.arrive}</span>}
          </div>
          {call.customer && note.title && note.title !== call.customer && (
            <p className="mt-0.5 break-words text-[13px] text-text-secondary">{note.title}</p>
          )}
          <p className="mt-1 break-words text-[12.5px] text-text-muted">
            {call.address || 'Sem endereço'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] font-semibold text-text-muted">
            <span className="rounded-full bg-bg-elevated-2 px-2 py-0.5 text-text-secondary">{callTypeLabel(call.callType)}</span>
            {call.equipment && (
              <span className="inline-flex items-center gap-1">
                <Icon name="printer" size={11} /> {call.equipment}
              </span>
            )}
            {total > 0 && (
              <span className="inline-flex items-center gap-1" style={{ color: doneCount === total ? 'var(--success)' : undefined }}>
                <Icon name="check-circle" size={11} /> {doneCount}/{total}
              </span>
            )}
            {eta?.leg && (
              <span>
                +{fmtDuration(eta.leg.duration)} · {fmtDistance(eta.leg.distance)}
              </span>
            )}
            {!loc && (
              <span className="inline-flex items-center gap-1 text-warning">
                <Icon name="alert-triangle" size={11} /> sem localização
              </span>
            )}
          </div>
        </div>
      </div>
      {loc && !done && (
        <div className="mt-2.5 flex gap-1.5 pl-10" onClick={(e) => e.stopPropagation()}>
          <a
            href={mapsUrlTo(loc)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[12px] font-semibold text-text-secondary hover:border-border-strong hover:text-text-primary"
          >
            <Icon name="navigation" size={12} /> Google Maps
          </a>
          <a
            href={wazeUrlTo(loc)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-[12px] font-semibold text-text-secondary hover:border-border-strong hover:text-text-primary"
          >
            <Icon name="navigation" size={12} /> Waze
          </a>
        </div>
      )}
    </div>
  )
}

/** Ponto de partida (base única, doc 19 D2) + horário de saída — guardados nas preferências locais. */
function BaseSheet({ onClose }: { onClose: () => void }) {
  const routeBase = useAppStore((s) => s.routeBase)
  const setRouteBase = useAppStore((s) => s.setRouteBase)
  const routeStart = useAppStore((s) => s.routeStart)
  const setRouteStart = useAppStore((s) => s.setRouteStart)
  const showToast = useAppStore((s) => s.showToast)
  const [address, setAddress] = useState(routeBase?.label ?? '')
  const [start, setStart] = useState(routeStart)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setRouteStart(start || '08:00')
    if (!address.trim()) {
      setRouteBase(null)
      return onClose()
    }
    if (routeBase && address === routeBase.label) return onClose()
    setBusy(true)
    try {
      const p = await geocode(address)
      if (!p) return showToast('Endereço da base não localizado')
      setRouteBase({ label: address.trim(), lat: p.lat, lon: p.lon })
      showToast('Base definida')
      onClose()
    } catch {
      showToast('Falha ao localizar a base')
    } finally {
      setBusy(false)
    }
  }

  const INPUT =
    'h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border-strong'
  return (
    <Modal
      title="Ponto de partida"
      onClose={onClose}
      footer={
        <>
          <div className="flex-1" />
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? <Icon name="loader-2" size={15} className="animate-spin" /> : <Icon name="check" size={15} />} Salvar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-text-muted">Endereço da base (empresa/garagem)</span>
          <input className={INPUT} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, cidade - UF" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-text-muted">Horário de saída</span>
          <input className={`${INPUT} max-w-[140px]`} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <p className="text-[12px] text-text-muted">
          As rotas começam na base e o horário de chegada em cada parada é estimado a partir da saída. Deixe o endereço em
          branco para não usar base.
        </p>
      </div>
    </Modal>
  )
}

import { Fragment } from 'react'
import { motion } from 'framer-motion'
import type { Reminder } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { useReminders } from '@/hooks/useReminders'
import { PriorityBadge, AvatarStack } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'

/** É hoje (data local)? */
function isToday(iso: string | null, now: Date): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Visão "Hoje" em timeline (#9, estilo Structured). Agenda do dia: os LEMBRETES com horário
 * marcado para hoje, em ordem cronológica, numa linha do tempo — com um marcador de "Agora"
 * entre o que já passou e o que ainda vem. Complementa o mural (não o substitui). Escopo:
 * todos os quadros (é a agenda pessoal do dia). Clicar abre a visualização do lembrete.
 */
export function HojeScreen() {
  const { data: reminders = [] } = useReminders()
  const openView = useAppStore((s) => s.openView)
  const now = new Date()
  const nowMs = now.getTime()

  // Lembretes (não tarefas) com horário HOJE, ativos, em ordem cronológica.
  const items = reminders
    .filter((r) => r.kind === 'reminder' && r.status !== 'archived' && isToday(r.remindAt, now))
    .sort((a, b) => new Date(a.remindAt!).getTime() - new Date(b.remindAt!).getTime())

  const upcoming = items.filter((r) => new Date(r.remindAt!).getTime() >= nowMs).length
  // Índice do primeiro item futuro — onde entra o marcador "Agora".
  const firstUpcomingIdx = items.findIndex((r) => new Date(r.remindAt!).getTime() >= nowMs)
  const nowIndex = firstUpcomingIdx === -1 ? items.length : firstUpcomingIdx

  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="mx-auto max-w-[720px]">
      {/* Cabeçalho do dia */}
      <div className="mb-5">
        <h2 className="text-[22px] font-extrabold tracking-[-.02em]">Hoje</h2>
        <p className="mt-0.5 text-sm capitalize text-text-secondary">
          {dateLabel}
          {items.length > 0 && (
            <span className="text-text-muted">
              {' · '}
              {items.length} {items.length === 1 ? 'lembrete' : 'lembretes'}
              {upcoming > 0 && `, ${upcoming} por vir`}
            </span>
          )}
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyToday />
      ) : (
        <div className="flex flex-col">
          {items.map((r, i) => (
            <Fragment key={r.id}>
              {i === nowIndex && <NowMarker time={hhmm(now.toISOString())} />}
              <TimelineRow reminder={r} past={new Date(r.remindAt!).getTime() < nowMs} onOpen={() => openView(r.id)} index={i} />
            </Fragment>
          ))}
          {/* Tudo já passou → o "Agora" fica no fim. */}
          {nowIndex === items.length && <NowMarker time={hhmm(now.toISOString())} last />}
        </div>
      )}
    </div>
  )
}

function NowMarker({ time, last = false }: { time: string; last?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 flex-none text-right text-[11px] font-bold uppercase tracking-[.04em] text-accent-ink">
        Agora
      </div>
      <div className="relative flex-none self-stretch">
        {/* Continua a trilha por cima (se não for o último). */}
        {!last && <div className="absolute left-1/2 top-1/2 h-1/2 w-px -translate-x-1/2 bg-border" />}
        <div className="absolute left-1/2 top-0 h-1/2 w-px -translate-x-1/2 bg-border" />
        <div className="relative my-1 h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--accent-surface)]" />
      </div>
      <div className="flex flex-1 items-center gap-2 py-1">
        <div className="h-px flex-1 bg-accent/40" />
        <span className="text-[11px] font-semibold text-text-muted">{time}</span>
      </div>
    </div>
  )
}

function TimelineRow({
  reminder: r,
  past,
  onOpen,
  index,
}: {
  reminder: Reminder
  past: boolean
  onOpen: () => void
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.25), ease: [0.16, 1, 0.3, 1] }}
      className="flex items-stretch gap-3"
    >
      {/* Coluna da hora */}
      <div className={`w-12 flex-none pt-3 text-right text-[13px] font-semibold ${past ? 'text-text-muted' : 'text-text-primary'}`}>
        {hhmm(r.remindAt!)}
      </div>

      {/* Trilha + ponto */}
      <div className="relative flex-none self-stretch">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
        <div
          className="relative mt-[15px] h-3 w-3 rounded-full border-2 bg-bg-base"
          style={{ borderColor: r.color, opacity: past ? 0.5 : 1 }}
        />
      </div>

      {/* Card compacto */}
      <button
        type="button"
        onClick={onOpen}
        className={`group mb-2.5 min-w-0 flex-1 rounded-lg border border-border bg-bg-elevated p-3 pl-3.5 text-left transition-all duration-150 hover:-translate-y-px hover:border-border-strong hover:bg-bg-elevated-2 hover:shadow-pop ${past ? 'opacity-70' : ''}`}
        style={{ borderLeft: `4px solid ${r.color}` }}
      >
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[14.5px] font-semibold leading-tight tracking-[-.01em]">
            {r.title}
          </h3>
          {r.pinned && <Icon name="pin" size={14} style={{ color: 'var(--accent)', transform: 'rotate(35deg)' }} />}
        </div>
        {r.body && <p className="mt-0.5 truncate text-[12.5px] text-text-secondary">{r.body}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <PriorityBadge priority={r.priority} size={11} />
          {r.recurrence !== 'once' && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-text-muted">
              <Icon name="repeat" size={11} /> repete
            </span>
          )}
          {!r.mine && r.ownerName && (
            <span className="text-[11.5px] text-text-muted">por {r.ownerName.split(' ')[0]}</span>
          )}
          {r.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[11.5px] text-text-muted">
              #{t}
            </span>
          ))}
          {r.shares.length > 0 && (
            <>
              <div className="flex-1" />
              <AvatarStack shares={r.shares} />
            </>
          )}
        </div>
      </button>
    </motion.div>
  )
}

function EmptyToday() {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
      <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-accent-surface text-accent-ink">
        <Icon name="calendar-clock" size={28} />
      </div>
      <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">Nada marcado para hoje</h3>
      <p className="max-w-[340px] text-sm">
        Lembretes com horário para hoje aparecem aqui, em ordem — do próximo ao último.
      </p>
    </div>
  )
}

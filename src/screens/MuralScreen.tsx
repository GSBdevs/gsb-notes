import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Reminder, Status } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { selectMural, useReminders, useSetStatus, useTogglePin } from '@/hooks/useReminders'
import { realtimeService } from '@/services/realtimeService'
import { ReminderCardView, type CardAction } from '@/components/ReminderCard'
import { Icon } from '@/components/ui/Icon'

const TABS: { key: Status; label: string }[] = [
  { key: 'active', label: 'Ativos' },
  { key: 'scheduled', label: 'Agendados' },
  { key: 'archived', label: 'Arquivados' },
]

export function MuralScreen() {
  const { data: reminders = [], isLoading } = useReminders()
  const activeTab = useAppStore((s) => s.activeTab)
  const setTab = useAppStore((s) => s.setTab)
  const query = useAppStore((s) => s.query)
  const setQuery = useAppStore((s) => s.setQuery)
  const openEditor = useAppStore((s) => s.openEditor)
  const openTrigger = useAppStore((s) => s.openTrigger)
  const showToast = useAppStore((s) => s.showToast)
  const setStatus = useSetStatus()
  const togglePin = useTogglePin()

  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const counts = {
    active: reminders.filter((r) => r.status === 'active').length,
    scheduled: reminders.filter((r) => r.status === 'scheduled').length,
    archived: reminders.filter((r) => r.status === 'archived').length,
  }
  const allTags = [...new Set(reminders.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b))
  const list = selectMural(reminders, activeTab, query).filter(
    (r) => !tagFilter || r.tags.includes(tagFilter),
  )
  const searching = query.trim().length > 0

  // Ações rápidas por card, conforme a aba (padrão Google Keep: hover-revealed).
  const actionsFor = (r: Reminder): CardAction[] => {
    const pin: CardAction = {
      icon: 'pin',
      label: r.pinned ? 'Desafixar' : 'Fixar',
      tone: r.pinned ? 'accent' : 'default',
      onClick: () => {
        togglePin.mutate(r)
        showToast(r.pinned ? 'Desafixado' : 'Fixado no topo')
      },
    }
    const edit: CardAction = { icon: 'pencil', label: 'Editar', onClick: () => openEditor(r) }
    const complete: CardAction = {
      icon: 'check',
      label: 'Concluir',
      onClick: () => {
        const prev = r.status
        setStatus.mutate({ id: r.id, status: 'archived' })
        showToast('Lembrete concluído', {
          label: 'Desfazer',
          run: () => setStatus.mutate({ id: r.id, status: prev }),
        })
      },
    }
    const restore: CardAction = {
      icon: 'rotate-ccw',
      label: 'Restaurar',
      onClick: () => {
        setStatus.mutate({ id: r.id, status: 'active' })
        showToast('Restaurado para Ativos', {
          label: 'Desfazer',
          run: () => setStatus.mutate({ id: r.id, status: 'archived' }),
        })
      },
    }
    // "Disparar agora": aparece chamativo neste dispositivo + nos de quem compartilha (broadcast).
    const fire: CardAction = {
      icon: 'zap',
      label: 'Disparar agora',
      onClick: () => {
        openTrigger(r.id)
        void realtimeService.fireNow(
          r.id,
          r.shares.map((s) => s.userId),
        )
        showToast('Disparado para os compartilhados')
      },
    }
    if (activeTab === 'archived') return [restore, edit]
    const base = activeTab === 'scheduled' ? [pin, edit] : [pin, complete, edit]
    return r.shares.length > 0 ? [fire, ...base] : base
  }

  return (
    <>
      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const on = activeTab === t.key
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
              <span
                className="text-xs font-bold"
                style={{ color: on ? 'rgba(10,10,11,.55)' : 'var(--text-muted)' }}
              >
                {counts[t.key]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Filtro por tag */}
      {allTags.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <Icon name="tag" size={13} style={{ color: 'var(--text-muted)' }} />
          {allTags.map((t) => {
            const on = tagFilter === t
            return (
              <button
                key={t}
                onClick={() => setTagFilter(on ? null : t)}
                className={`inline-flex items-center gap-0.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                  on
                    ? 'border-accent bg-accent-surface text-accent'
                    : 'border-border bg-bg-elevated text-text-secondary hover:border-border-strong'
                }`}
              >
                <span className="opacity-60">#</span>
                {t}
              </button>
            )
          })}
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              className="ml-0.5 text-[12.5px] font-medium text-text-muted hover:text-text-primary"
            >
              limpar
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="px-1 py-10 text-sm text-text-muted">Carregando lembretes…</p>
      ) : list.length > 0 ? (
        <div className="masonry">
          {list.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.2), ease: [0.16, 1, 0.3, 1] }}
            >
              <ReminderCardView
                color={r.color}
                title={r.title}
                body={r.body}
                priority={r.priority}
                pinned={r.pinned}
                time={r.time}
                shares={r.shares}
                tags={r.tags}
                mine={r.mine}
                seenCount={r.reads.filter((rd) => r.shares.some((s) => s.userId === rd.userId)).length}
                onClick={() => openEditor(r)}
                actions={actionsFor(r)}
              />
            </motion.div>
          ))}
        </div>
      ) : searching ? (
        <NoResults query={query} onClear={() => setQuery('')} />
      ) : (
        <EmptyState onCreate={() => openEditor(null)} />
      )}
    </>
  )
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
      <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-bg-elevated text-text-muted">
        <Icon name="search-x" size={26} />
      </div>
      <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">Nada encontrado</h3>
      <p className="mb-5 max-w-[340px] text-sm">
        Nenhum lembrete corresponde a <span className="font-semibold text-text-primary">“{query}”</span>{' '}
        nesta aba.
      </p>
      <button
        onClick={onClear}
        className="inline-flex h-[42px] items-center gap-2 rounded-md border border-border bg-bg-elevated px-[18px] text-sm font-semibold text-text-primary transition-colors hover:border-border-strong"
      >
        <Icon name="x" size={16} /> Limpar busca
      </button>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
      <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-accent-surface text-accent">
        <Icon name="bell-plus" size={28} />
      </div>
      <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">Nenhum lembrete aqui</h3>
      <p className="mb-5 max-w-[320px] text-sm">
        Crie o primeiro e ele aparece chamativo na tela quando chegar a hora.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-[18px] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
      >
        <Icon name="plus" size={16} /> Criar lembrete
      </button>
    </div>
  )
}

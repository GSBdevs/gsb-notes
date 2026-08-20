import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Reminder } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { selectMural, useReminders, useSetStatus, useTogglePin } from '@/hooks/useReminders'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { canEditReminder } from '@/lib/reminders'
import { notesService } from '@/services/notesService'
import { realtimeService } from '@/services/realtimeService'
import { ReminderCardView, type CardAction } from '@/components/ReminderCard'
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher'
import { Icon } from '@/components/ui/Icon'

// Ativos agrupa ativos + agendados; "Concluídos" = os antigos arquivados.
type MuralTab = 'active' | 'archived'
const TABS: { key: MuralTab; label: string }[] = [
  { key: 'active', label: 'Ativos' },
  { key: 'archived', label: 'Concluídos' },
]

export function MuralScreen() {
  const { data: reminders = [], isLoading } = useReminders()
  const rawTab = useAppStore((s) => s.activeTab)
  const setTab = useAppStore((s) => s.setTab)
  const query = useAppStore((s) => s.query)
  const setQuery = useAppStore((s) => s.setQuery)
  const openEditor = useAppStore((s) => s.openEditor)
  const openView = useAppStore((s) => s.openView)
  const openTrigger = useAppStore((s) => s.openTrigger)
  const showToast = useAppStore((s) => s.showToast)
  const muralView = useAppStore((s) => s.muralView)
  const setMuralView = useAppStore((s) => s.setMuralView)
  const setStatus = useSetStatus()
  const togglePin = useTogglePin()
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId)
  const { data: workspaces = [] } = useWorkspaces()

  const [tagFilter, setTagFilter] = useState<string | null>(null)

  // 'scheduled' pode ter ficado persistido de versões antigas — trata como Ativos.
  const activeTab: MuralTab = rawTab === 'archived' ? 'archived' : 'active'
  const myWorkspaceIds = new Set(workspaces.map((w) => w.id))

  // Escopo do mural: só LEMBRETES (docs vivem em /tarefas) + quadro ativo (null = Pessoal).
  const scoped = reminders.filter(
    (r) => r.kind === 'reminder' && r.workspaceId === activeWorkspaceId,
  )

  const counts = {
    active: scoped.filter((r) => r.status !== 'archived').length,
    archived: scoped.filter((r) => r.status === 'archived').length,
  }
  const allTags = [...new Set(scoped.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b))
  const list = selectMural(scoped, activeTab, query).filter(
    (r) => !tagFilter || r.tags.includes(tagFilter),
  )
  const searching = query.trim().length > 0

  // Ações rápidas por card, conforme a aba (padrão Google Keep: hover-revealed).
  // Editar/Concluir só para quem pode (dono, share 'edit' ou membro do quadro).
  const actionsFor = (r: Reminder): CardAction[] => {
    const canEdit = canEditReminder(r, myWorkspaceIds)
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
    // "Disparar agora": só o DONO (a RPC autoriza só ele) → compartilhados + membros do quadro.
    const fire: CardAction = {
      icon: 'zap',
      label: 'Disparar agora',
      onClick: () => {
        openTrigger(r.id)
        void (async () => {
          let targets = r.shares.map((s) => s.userId)
          if (r.workspaceId) {
            try {
              const members = await notesService.listWorkspaceMembers(r.workspaceId)
              targets = [...targets, ...members.map((m) => m.userId)]
            } catch {
              /* sem membros acessíveis: segue só com os shares */
            }
          }
          await realtimeService.fireNow(r.id, targets)
        })()
        showToast('Disparado para os compartilhados')
      },
    }
    if (activeTab === 'archived') return canEdit ? [restore, edit] : []
    const base = canEdit ? [pin, complete, edit] : [pin]
    const canFire = r.mine && (r.shares.length > 0 || r.workspaceId !== null)
    return canFire ? [fire, ...base] : base
  }

  return (
    <>
      {/* Seletor de quadro (Pessoal / workspaces) */}
      <WorkspaceSwitcher />

      {/* Tabs + seletor de visualização */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
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
        <div className="flex-1" />
        <ViewToggle view={muralView} onChange={setMuralView} />
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
        <div className={muralView === 'list' ? 'flex flex-col gap-2' : 'masonry'}>
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
                ownerName={r.ownerName}
                ownerColor={r.ownerColor}
                ownerAvatar={r.ownerAvatar}
                seenCount={r.reads.filter((rd) => r.shares.some((s) => s.userId === rd.userId)).length}
                onClick={() => openView(r.id)}
                actions={actionsFor(r)}
                layout={muralView}
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

function ViewToggle({
  view,
  onChange,
}: {
  view: 'cards' | 'list'
  onChange: (v: 'cards' | 'list') => void
}) {
  const opts: { key: 'cards' | 'list'; icon: string; label: string }[] = [
    { key: 'cards', icon: 'layout-grid', label: 'Cards' },
    { key: 'list', icon: 'layout-list', label: 'Lista' },
  ]
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-bg-elevated p-0.5">
      {opts.map((o) => {
        const on = view === o.key
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-label={`Ver em ${o.label.toLowerCase()}`}
            aria-pressed={on}
            title={o.label}
            className={`grid h-7 w-7 place-items-center rounded transition-colors ${
              on ? 'bg-accent-surface text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon name={o.icon} size={16} />
          </button>
        )
      })}
    </div>
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

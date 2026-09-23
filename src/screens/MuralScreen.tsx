import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Reminder, Workspace } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { selectMural, useDeleteReminder, useReminders, useSetStatus, useTogglePin } from '@/hooks/useReminders'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { canEditReminder } from '@/lib/reminders'
import { GENERAL_SCOPE_ID, tint } from '@/lib/constants'
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
  const deleteReminder = useDeleteReminder()
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId)
  const { data: workspaces = [] } = useWorkspaces()

  const [tagFilter, setTagFilter] = useState<string | null>(null)
  // Exclusão em dois toques: o 1º clique arma; o 2º (em até 3,5s) confirma. Guarda o id armado.
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null)

  // 'scheduled' pode ter ficado persistido de versões antigas — trata como Ativos.
  const activeTab: MuralTab = rawTab === 'archived' ? 'archived' : 'active'

  // "Geral": quadro só-leitura que agrega os lembretes de TODOS os quadros, agrupados por quadro.
  const isGeneral = activeWorkspaceId === GENERAL_SCOPE_ID

  // Escopo do mural: só LEMBRETES (docs vivem em /tarefas). Geral = todos; senão o quadro ativo.
  const scoped = reminders.filter(
    (r) => r.kind === 'reminder' && (isGeneral || r.workspaceId === activeWorkspaceId),
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
    const canEdit = canEditReminder(r, workspaces)
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
    // Excluir (só o dono; a RLS notes_delete garante). Dois toques: arma → confirma.
    const armed = confirmDelId === r.id
    const del: CardAction = {
      icon: armed ? 'check' : 'trash-2',
      // Label ESTÁVEL (o ReminderCardView chaveia por label — mudá-lo remontaria o botão e
      // perderia o "armado"). O feedback de confirmação é o ícone (lixeira → check) + tom vermelho.
      label: 'Excluir',
      tone: 'danger',
      onClick: () => {
        if (!armed) {
          setConfirmDelId(r.id)
          setTimeout(() => setConfirmDelId((c) => (c === r.id ? null : c)), 3500)
          return
        }
        deleteReminder.mutate(r.id)
        showToast('Lembrete excluído')
        setConfirmDelId(null)
      },
    }
    if (activeTab === 'archived') return canEdit ? (r.mine ? [restore, edit, del] : [restore, edit]) : []
    const base = canEdit ? [pin, complete, edit] : [pin]
    const withDel = r.mine ? [...base, del] : base
    const canFire = r.mine && (r.shares.length > 0 || r.workspaceId !== null)
    return canFire ? [fire, ...withDel] : withDel
  }

  // Render de uma leva de cards (reutilizado no mural normal e nos grupos do Geral). No Geral é só
  // leitura (sem ações inline) e os cards herdam a cor do quadro (colorOverride) p/ organização.
  const renderCards = (items: Reminder[], colorOverride?: string, withActions = true) => (
    <div className={muralView === 'list' ? 'flex flex-col gap-2' : 'masonry'}>
      {items.map((r, i) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.2), ease: [0.16, 1, 0.3, 1] }}
        >
          <ReminderCardView
            color={colorOverride ?? r.color}
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
            actions={withActions ? actionsFor(r) : undefined}
            layout={muralView}
          />
        </motion.div>
      ))}
    </div>
  )

  const generalGroups = isGeneral ? buildGeneralGroups(list, workspaces) : []

  return (
    <>
      {/* Seletor de quadro (Geral / Pessoal / workspaces) */}
      <WorkspaceSwitcher showGeneral />

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
                    ? 'border-accent bg-accent-surface text-accent-ink'
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
      ) : list.length === 0 ? (
        searching ? (
          <NoResults query={query} onClear={() => setQuery('')} />
        ) : isGeneral ? (
          <GeneralEmpty />
        ) : (
          <EmptyState onCreate={() => openEditor(null)} />
        )
      ) : isGeneral ? (
        // Quadro Geral: só leitura, agrupado por origem (pessoais → compartilhados → por quadro).
        <div className="flex flex-col gap-7">
          {generalGroups.map((g) => (
            <section key={g.key}>
              {g.workspace ? (
                <WorkspaceBand ws={g.workspace} count={g.items.length} />
              ) : (
                <GroupLabel icon={g.icon!} label={g.label!} count={g.items.length} />
              )}
              {renderCards(g.items, g.workspace?.color, false)}
            </section>
          ))}
        </div>
      ) : (
        renderCards(list)
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
              on ? 'bg-accent-surface text-accent-ink' : 'text-text-muted hover:text-text-primary'
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
      <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-accent-surface text-accent-ink">
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

/** Um grupo do quadro Geral: por quadro (com `workspace`) ou por origem (com `label`/`icon`). */
interface GeneralGroup {
  key: string
  label?: string
  icon?: string
  workspace?: Workspace
  items: Reminder[]
}

/**
 * Monta os grupos do Geral na ordem pedida: (1) Pessoais (meus, sem compartilhamento) →
 * (2) Compartilhados sem quadro → (3) um grupo por quadro (na ordem dos quadros). Grupos vazios
 * são omitidos. `list` já vem ordenada (fixados primeiro), então a ordem se mantém dentro de cada grupo.
 */
function buildGeneralGroups(list: Reminder[], workspaces: Workspace[]): GeneralGroup[] {
  const groups: GeneralGroup[] = []
  const personal = list.filter((r) => r.workspaceId === null && r.mine && r.shares.length === 0)
  const shared = list.filter((r) => r.workspaceId === null && !(r.mine && r.shares.length === 0))
  if (personal.length) groups.push({ key: 'personal', label: 'Pessoais', icon: 'bell', items: personal })
  if (shared.length) groups.push({ key: 'shared', label: 'Compartilhados', icon: 'share-2', items: shared })

  const known = new Set<string>()
  for (const w of workspaces) {
    known.add(w.id)
    const items = list.filter((r) => r.workspaceId === w.id)
    if (items.length) groups.push({ key: w.id, workspace: w, items })
  }
  // Lembretes num quadro que eu não carrego (ex.: acesso perdido) — mantêm a cor própria.
  const orphans = list.filter((r) => r.workspaceId !== null && !known.has(r.workspaceId))
  if (orphans.length) groups.push({ key: 'orphans', label: 'Outros quadros', icon: 'layers', items: orphans })
  return groups
}

/** Faixa colorida do quadro no Geral: nome + cor do quadro + contagem. */
function WorkspaceBand({ ws, count }: { ws: Workspace; count: number }) {
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

/** Cabeçalho de grupo por origem (Pessoais / Compartilhados) no Geral. */
function GroupLabel({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
      <Icon name={icon} size={14} />
      {label}
      <span className="font-bold">{count}</span>
    </div>
  )
}

function GeneralEmpty() {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
      <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-accent-surface text-accent-ink">
        <Icon name="layers" size={28} />
      </div>
      <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">Seu quadro Geral está vazio</h3>
      <p className="max-w-[350px] text-sm">
        Ele reúne — só para visualização — os lembretes de todos os quadros. Crie lembretes no
        Pessoal ou em um quadro e eles aparecem aqui, organizados por origem.
      </p>
    </div>
  )
}

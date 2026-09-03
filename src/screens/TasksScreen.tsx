import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Reminder } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { useReminders } from '@/hooks/useReminders'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { AvatarStack } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'

type Tab = 'active' | 'archived'

/**
 * Tarefas & anotações (Fase 4). Documentos com checklist + texto livre, compartilháveis
 * como os lembretes (1:1 e quadros) — modelo Cozi/TickTick de listas compartilhadas.
 * São `notes` com kind='doc': sem alarme, mas com comentários/anexos/realtime.
 */
export function TasksScreen() {
  const { data: reminders = [], isLoading } = useReminders()
  const openTask = useAppStore((s) => s.openTask)
  const { data: workspaces = [] } = useWorkspaces()
  const [tab, setTab] = useState<Tab>('active')

  const docs = reminders.filter((r) => r.kind === 'doc')
  const counts = {
    active: docs.filter((r) => r.status !== 'archived').length,
    archived: docs.filter((r) => r.status === 'archived').length,
  }
  const list = docs
    .filter((r) => (tab === 'archived' ? r.status === 'archived' : r.status !== 'archived'))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))

  const TABS: { key: Tab; label: string }[] = [
    { key: 'active', label: 'Ativas' },
    { key: 'archived', label: 'Concluídas' },
  ]

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-2">
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

      {isLoading ? (
        <p className="px-1 py-10 text-sm text-text-muted">Carregando tarefas…</p>
      ) : list.length > 0 ? (
        <div className="masonry">
          {list.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.2), ease: [0.16, 1, 0.3, 1] }}
            >
              <TaskCard
                task={r}
                workspaceName={workspaces.find((w) => w.id === r.workspaceId)?.name}
                workspaceColor={workspaces.find((w) => w.id === r.workspaceId)?.color}
                onOpen={() => openTask(r)}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
          <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-accent-surface text-accent-ink">
            <Icon name="list-todo" size={28} />
          </div>
          <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">
            {tab === 'archived' ? 'Nada concluído ainda' : 'Nenhuma tarefa aqui'}
          </h3>
          <p className="mb-5 max-w-[340px] text-sm">
            Crie listas de tarefas e anotações — para você, para alguém ou para um quadro inteiro.
          </p>
          {tab === 'active' && (
            <button
              onClick={() => openTask(null)}
              className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-[18px] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
            >
              <Icon name="plus" size={16} /> Nova tarefa
            </button>
          )}
        </div>
      )}
    </>
  )
}

function TaskCard({
  task: r,
  workspaceName,
  workspaceColor,
  onOpen,
}: {
  task: Reminder
  workspaceName?: string
  workspaceColor?: string
  onOpen: () => void
}) {
  const total = r.checklist.length
  const doneCount = r.checklist.filter((c) => c.done).length
  const done = r.status === 'archived'
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
      className="group relative cursor-pointer rounded-lg border border-border bg-bg-elevated p-4 pb-3.5 transition-all duration-150 hover:-translate-y-px hover:border-border-strong hover:bg-bg-elevated-2 hover:shadow-pop"
      style={{ borderLeft: `4px solid ${r.color}` }}
    >
      <div className="mb-1.5 flex items-start gap-2">
        <h3
          className={`flex-1 text-[15px] font-semibold leading-tight tracking-[-.01em] ${
            done ? 'text-text-muted line-through' : ''
          }`}
        >
          {r.title}
        </h3>
        {r.pinned && (
          <Icon name="pin" size={15} style={{ color: 'var(--accent)', transform: 'rotate(35deg)' }} />
        )}
      </div>

      {total > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {r.checklist.slice(0, 4).map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-[13px]">
              <span
                className={`grid h-3.5 w-3.5 flex-none place-items-center rounded-full border ${
                  item.done ? 'border-success bg-success text-[#0A0A0B]' : 'border-border-strong'
                }`}
              >
                {item.done && <Icon name="check" size={9} strokeWidth={3.5} />}
              </span>
              <span className={item.done ? 'text-text-muted line-through' : 'text-text-secondary'}>
                {item.text}
              </span>
            </div>
          ))}
          {total > 4 && <span className="pl-[22px] text-[12px] text-text-muted">+{total - 4} itens…</span>}
        </div>
      )}

      {r.body && !total && (
        <p className="mb-2 text-[13.5px] leading-normal text-text-secondary line-clamp-3">{r.body}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {total > 0 && (
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: doneCount === total ? 'var(--success)' : 'var(--text-muted)' }}
          >
            <Icon name="check-circle" size={12} />
            {doneCount}/{total}
          </span>
        )}
        {workspaceName && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bg-elevated-2 px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
            <span className="h-2 w-2 rounded-full" style={{ background: workspaceColor }} />
            {workspaceName}
          </span>
        )}
        {!r.mine && (
          <span className="text-[11px] font-semibold text-text-muted">por {r.ownerName.split(' ')[0]}</span>
        )}
        {r.shares.length > 0 && (
          <>
            <div className="flex-1" />
            <AvatarStack shares={r.shares} />
          </>
        )}
      </div>
    </div>
  )
}

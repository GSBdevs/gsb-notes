import { motion } from 'framer-motion'
import type { Status } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { selectMural, useReminders } from '@/hooks/useReminders'
import { ReminderCardView } from '@/components/ReminderCard'
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
  const openEditor = useAppStore((s) => s.openEditor)

  const counts = {
    active: reminders.filter((r) => r.status === 'active').length,
    scheduled: reminders.filter((r) => r.status === 'scheduled').length,
    archived: reminders.filter((r) => r.status === 'archived').length,
  }
  const list = selectMural(reminders, activeTab, query)

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
                onClick={() => openEditor(r)}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState onCreate={() => openEditor(null)} />
      )}
    </>
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

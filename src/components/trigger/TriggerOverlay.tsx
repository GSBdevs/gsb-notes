import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { useReminders, useSetRemindAt, useSetStatus } from '@/hooks/useReminders'
import { AvatarStack, PriorityBadge } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'
import { platform } from '@/platform'
import { notesService } from '@/services/notesService'

const GLOW_LOW = '0 0 0 2px #FACC15, 0 0 24px rgba(250,204,21,.30), 0 24px 60px rgba(0,0,0,.7)'
const GLOW_HIGH = '0 0 0 3px #FDE047, 0 0 56px rgba(250,204,21,.65), 0 24px 60px rgba(0,0,0,.7)'
const GLOW_STATIC = '0 0 0 2px #FACC15, 0 0 40px rgba(250,204,21,.45), 0 24px 60px rgba(0,0,0,.7)'

export function TriggerOverlay() {
  const triggerOpen = useAppStore((s) => s.triggerOpen)
  const triggerId = useAppStore((s) => s.triggerId)
  const closeTrigger = useAppStore((s) => s.closeTrigger)
  const openEditor = useAppStore((s) => s.openEditor)
  const showToast = useAppStore((s) => s.showToast)
  const reduceSetting = useAppStore((s) => s.settings.reduce)
  const ontop = useAppStore((s) => s.settings.ontop)
  const setStatus = useSetStatus()
  const setRemindAt = useSetRemindAt()
  const { data: reminders = [] } = useReminders()
  const prefersReduced = useReducedMotion()

  // Quando triggerId é null (ex.: "testar disparo" de um lembrete novo), cai num exemplo.
  const reminder =
    reminders.find((r) => r.id === triggerId) ??
    reminders.find((r) => r.status === 'active') ??
    reminders[0]

  useEffect(() => {
    if (triggerOpen && reminder) {
      platform.notifyNow(reminder, { alwaysOnTop: ontop })
      // Recibo "visto por": se o lembrete é de outra pessoa, registra que EU o vi agora.
      if (!reminder.mine) void notesService.markSeen(reminder.id)
    }
    // Ao fechar (ou trocar de lembrete), solta o always-on-top na casca nativa.
    return () => platform.dismissTrigger?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerOpen, triggerId])

  if (!triggerOpen || !reminder) return null

  const reduce = reduceSetting || !!prefersReduced
  const isUrgent = reminder.priority === 'urgent'

  // "Visto por": só o dono vê os recibos dos destinatários.
  const seenIds = new Set(reminder.reads.map((r) => r.userId))
  const seenNames = reminder.shares.filter((s) => seenIds.has(s.userId)).map((s) => s.name.split(' ')[0])
  const showReceipts = reminder.mine && reminder.shares.length > 0

  const complete = async () => {
    await setStatus.mutateAsync({ id: reminder.id, status: 'archived' })
    showToast('Lembrete concluído')
    closeTrigger()
  }
  const snooze = () => {
    // Reagenda para daqui a 10 min — o agendador dispara de novo no horário.
    const iso = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    setRemindAt.mutate({ id: reminder.id, iso })
    showToast('Adiado por 10 minutos')
    closeTrigger()
  }
  const openReminder = () => {
    closeTrigger()
    openEditor(reminder)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(700px 500px at 50% 45%, rgba(250,204,21,.10), rgba(0,0,0,.72) 70%)',
      }}
    >
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, x: 0 }}
        animate={
          reduce
            ? { opacity: 1, boxShadow: GLOW_STATIC }
            : {
                opacity: 1,
                scale: 1,
                x: isUrgent ? [0, -9, 8, -5, 3, 0] : 0,
                boxShadow: [GLOW_LOW, GLOW_HIGH, GLOW_LOW],
              }
        }
        transition={
          reduce
            ? { duration: 0.25 }
            : {
                default: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                x: { duration: 0.5, ease: [0.36, 0.07, 0.19, 0.97] },
                boxShadow: {
                  duration: 1.1,
                  times: [0, 0.5, 1],
                  repeat: 2,
                  delay: 0.3,
                  ease: 'easeInOut',
                },
              }
        }
        className="relative w-full max-w-[460px] rounded-xl border-2 border-accent bg-bg-elevated p-[26px]"
        style={{ boxShadow: GLOW_STATIC }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid h-[30px] w-[30px] place-items-center rounded-md bg-accent text-text-on-accent">
            <Icon name="bell-ring" size={16} />
          </span>
          <span className="text-[13px] font-bold uppercase tracking-[.06em] text-accent">
            Lembrete agora
          </span>
          <div className="flex-1" />
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-text-secondary">
            <Icon name="clock" size={14} />
            {reminder.time}
          </span>
        </div>

        <PriorityBadge priority={reminder.priority} size={12} />

        <h1 className="mb-3 mt-3.5 text-[32px] font-extrabold leading-[1.1] tracking-[-.02em]">
          {reminder.title}
        </h1>
        <p className="mb-[26px] text-base leading-relaxed text-text-secondary">{reminder.body}</p>

        {reminder.shares.length > 0 && (
          <div className="mb-6 rounded-md border border-border bg-bg-base px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              <AvatarStack shares={reminder.shares} size={26} />
              <span className="text-[13px] text-text-secondary">
                Aparecendo também para {reminder.shares.map((s) => s.name.split(' ')[0]).join(', ')}
              </span>
            </div>
            {showReceipts && (
              <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-[12.5px]">
                <Icon name="eye" size={13} style={{ color: seenNames.length ? 'var(--accent)' : 'var(--text-muted)' }} />
                <span className={seenNames.length ? 'text-text-secondary' : 'text-text-muted'}>
                  {seenNames.length ? `Visto por ${seenNames.join(', ')}` : 'Ninguém viu ainda'}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={complete}
            className="flex h-[52px] min-w-[130px] flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-bold text-text-on-accent transition-colors hover:bg-accent-hover"
          >
            <Icon name="check" size={18} /> Concluir
          </button>
          <button
            onClick={snooze}
            className="flex h-[52px] min-w-[130px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-bg-elevated-2 text-[15px] font-semibold text-text-primary transition-colors hover:border-border-strong"
          >
            <Icon name="alarm-clock" size={18} /> Adiar 10 min
          </button>
          <button
            onClick={openReminder}
            title="Abrir"
            className="grid h-[52px] w-[52px] flex-none place-items-center rounded-xl border border-border bg-transparent text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Icon name="maximize-2" size={20} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

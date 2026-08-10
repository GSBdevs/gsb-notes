import { useEffect, useRef } from 'react'
import { useReminders, useSetRemindAt } from '@/hooks/useReminders'
import { nextOccurrence } from '@/lib/reminders'
import { useAppStore } from '@/store/useAppStore'

const HORIZON_MS = 24 * 60 * 60 * 1000 // só agenda timers para as próximas 24h

/**
 * Agendador local (Fase 2, RF-04/05). Com o app aberto, abre o overlay chamativo
 * quando o `remindAt` de um lembrete chega (o próprio overlay dispara a notificação
 * do SO via platform.notifyNow). Como o `remindAt` é sincronizado em todos os clientes
 * (Postgres Changes), um lembrete compartilhado dispara para todos ao mesmo tempo.
 *
 * Escopo MVP: dispara com o app aberto; lembretes vencidos com o app fechado não
 * "voltam" ao abrir (isso é o disparo server-side — Edge Function + cron, futuro).
 * Recorrência ainda dispara só uma vez (reagendar próxima ocorrência é follow-up).
 */
export function ReminderScheduler() {
  const { data: reminders = [] } = useReminders()
  const openTrigger = useAppStore((s) => s.openTrigger)
  const setRemindAt = useSetRemindAt()
  const fired = useRef<Set<string>>(new Set())

  useEffect(() => {
    const now = Date.now()
    const timers: ReturnType<typeof setTimeout>[] = []

    for (const r of reminders) {
      if (r.status === 'archived' || !r.remindAt) continue
      const at = new Date(r.remindAt).getTime()
      if (Number.isNaN(at)) continue
      const delay = at - now
      const key = `${r.id}:${r.remindAt}` // reagenda se o horário mudar
      if (delay <= 0 || delay > HORIZON_MS || fired.current.has(key)) continue

      timers.push(
        setTimeout(() => {
          fired.current.add(key)
          openTrigger(r.id)
          // Recorrência: reagenda para a próxima ocorrência (o mural re-sincroniza).
          if (r.recurrence !== 'once' && r.remindAt) {
            const next = nextOccurrence(r.remindAt, r.recurrence)
            if (next) setRemindAt.mutate({ id: r.id, iso: next })
          }
        }, delay),
      )
    }

    return () => timers.forEach(clearTimeout)
  }, [reminders, openTrigger, setRemindAt])

  return null
}

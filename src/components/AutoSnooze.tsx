import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useReminders } from '@/hooks/useReminders'
import { MAX_SNOOZE_ATTEMPTS } from '@/lib/constants'

/**
 * Auto-snooze persistente (backlog #1, modelo Due). Quando um lembrete com `autoSnooze`
 * dispara e o usuário FECHA o overlay sem concluir nem reagendar, o disparo reaparece
 * sozinho a cada `snoozeIntervalMin` minutos — "impossível de ignorar" — até:
 *   • Concluir (status vira 'archived'), ou
 *   • Reagendar/Adiar (o `remindAt` muda → o agendador cuida da próxima), ou
 *   • bater o teto de {MAX_SNOOZE_ATTEMPTS} tentativas (para não virar tortura).
 *
 * É insistência LOCAL (re-abre o overlay neste cliente), não mexe no `remindAt` da nota —
 * então não move o horário para os outros participantes. Timer in-app: se o app é morto,
 * o catch-up do ReminderScheduler recupera na reabertura.
 */
export function AutoSnooze() {
  const triggerOpen = useAppStore((s) => s.triggerOpen)
  const triggerId = useAppStore((s) => s.triggerId)
  const openTrigger = useAppStore((s) => s.openTrigger)
  const { data: reminders = [] } = useReminders()

  const remindersRef = useRef(reminders)
  remindersRef.current = reminders

  // Tentativas já feitas por lembrete (reseta ao concluir/reagendar). Só em memória.
  const attempts = useRef<Map<string, number>>(new Map())
  // Snapshot de qual lembrete/horário estava no overlay quando abriu.
  const openSnapshot = useRef<{ id: string; remindAt: string | null } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevOpen = useRef(false)

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }

    // Abriu (ou trocou de lembrete no overlay): fotografa e cancela re-arme pendente.
    if (triggerOpen && triggerId) {
      const r = remindersRef.current.find((x) => x.id === triggerId)
      openSnapshot.current = { id: triggerId, remindAt: r?.remindAt ?? null }
      clearTimer()
    }

    // Fechou (true → false): decide se re-alerta.
    if (prevOpen.current && !triggerOpen) {
      const snap = openSnapshot.current
      if (snap) {
        const r = remindersRef.current.find((x) => x.id === snap.id)
        const done = !r || r.status === 'archived'
        const rescheduled = !!r && r.remindAt !== snap.remindAt // Adiar/reagendar mudou o horário
        if (r && r.autoSnooze && !done && !rescheduled) {
          const n = attempts.current.get(snap.id) ?? 0
          if (n < MAX_SNOOZE_ATTEMPTS) {
            const min = r.snoozeIntervalMin || 10
            clearTimer()
            timer.current = setTimeout(() => {
              attempts.current.set(snap.id, n + 1)
              openTrigger(snap.id)
            }, min * 60_000)
          } else {
            attempts.current.delete(snap.id) // desistiu; zera para uma próxima ocorrência
          }
        } else {
          attempts.current.delete(snap.id) // concluído/reagendado: encerra a insistência
        }
      }
    }

    prevOpen.current = triggerOpen
  }, [triggerOpen, triggerId, openTrigger])

  // Limpa o timer ao desmontar (logout).
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return null
}

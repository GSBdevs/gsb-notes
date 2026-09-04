import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useReminders } from '@/hooks/useReminders'
import { MAX_SNOOZE_ATTEMPTS } from '@/lib/constants'

/**
 * Auto-snooze persistente (backlog #1, modelo Due). Decide, quando o overlay de disparo
 * FECHA, se ele deve reaparecer sozinho — a insistência "impossível de ignorar":
 *
 *   • Concluído ('done')           → para (o usuário reconheceu).
 *   • Adiado por MIM, dono          → para (o meu "Adiar" já reagendou o `remind_at`; o
 *                                     ReminderScheduler dispara no novo horário).
 *   • Adiado por MIM, destinatário  → re-alerta após `snoozeIntervalMin` (o "Adiar" do
 *                                     destinatário NÃO mexe no horário compartilhado; a
 *                                     insistência é local a este cliente).
 *   • Apenas dispensado ('dismiss') → re-alerta após o intervalo SE o lembrete tem
 *                                     `autoSnooze` ligado (o "pester until acknowledged").
 *
 * Teto de {MAX_SNOOZE_ATTEMPTS} tentativas por ocorrência (para não virar tortura). Timer
 * in-app: se o app é morto, o catch-up do ReminderScheduler recupera na reabertura.
 */
export function AutoSnooze() {
  const triggerOpen = useAppStore((s) => s.triggerOpen)
  const triggerId = useAppStore((s) => s.triggerId)
  const triggerOutcome = useAppStore((s) => s.triggerOutcome)
  const openTrigger = useAppStore((s) => s.openTrigger)
  const { data: reminders = [] } = useReminders()

  const remindersRef = useRef(reminders)
  remindersRef.current = reminders

  // Tentativas já feitas por lembrete (reseta ao concluir/reagendar). Só em memória.
  const attempts = useRef<Map<string, number>>(new Map())
  // Foto do lembrete que estava no overlay quando abriu (evita corrida com o cache).
  const snap = useRef<{ id: string; mine: boolean; autoSnooze: boolean; intervalMin: number } | null>(
    null,
  )
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevOpen = useRef(false)

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current) {
        clearTimeout(timer.current)
        timer.current = null
      }
    }

    // Abriu (ou trocou de lembrete): fotografa e cancela re-arme pendente.
    if (triggerOpen && triggerId) {
      const r = remindersRef.current.find((x) => x.id === triggerId)
      snap.current = r
        ? { id: r.id, mine: r.mine, autoSnooze: r.autoSnooze, intervalMin: r.snoozeIntervalMin || 10 }
        : null
      clearTimer()
    }

    // Fechou (true → false): decide se re-alerta, pelo desfecho.
    if (prevOpen.current && !triggerOpen) {
      const s = snap.current
      if (s) {
        // Adiar do destinatário re-alerta; dispensar re-alerta só com autoSnooze; concluir/adiar-dono param.
        const recipientSnooze = triggerOutcome === 'snoozed' && !s.mine
        const pesterDismiss = triggerOutcome === 'dismiss' && s.autoSnooze
        if (recipientSnooze || pesterDismiss) {
          const n = attempts.current.get(s.id) ?? 0
          if (n < MAX_SNOOZE_ATTEMPTS) {
            clearTimer()
            timer.current = setTimeout(() => {
              attempts.current.set(s.id, n + 1)
              openTrigger(s.id)
            }, s.intervalMin * 60_000)
          } else {
            attempts.current.delete(s.id) // desistiu; zera para uma próxima ocorrência
          }
        } else {
          attempts.current.delete(s.id) // concluído / reagendado pelo dono: encerra
        }
      }
    }

    prevOpen.current = triggerOpen
  }, [triggerOpen, triggerId, triggerOutcome, openTrigger])

  // Limpa o timer ao desmontar (logout).
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return null
}

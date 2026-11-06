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
  const triggerId = useAppStore((s) => s.triggerId)
  const lastClosed = useAppStore((s) => s.lastClosed)
  const openTrigger = useAppStore((s) => s.openTrigger)
  const { data: reminders = [] } = useReminders()

  const remindersRef = useRef(reminders)
  remindersRef.current = reminders

  // Tentativas já feitas por lembrete (reseta ao concluir/reagendar). Só em memória.
  const attempts = useRef<Map<string, number>>(new Map())
  // Timers de re-alerta POR lembrete (a fila pode ter vários "insistindo" ao mesmo tempo).
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const seenSeq = useRef(0)

  const clearTimerFor = (id: string) => {
    const t = timers.current.get(id)
    if (t) {
      clearTimeout(t)
      timers.current.delete(id)
    }
  }

  // Quando um lembrete é exibido (é o da frente da fila), cancela um re-alerta pendente dele.
  useEffect(() => {
    if (triggerId) clearTimerFor(triggerId)
  }, [triggerId])

  // Ao FECHAR um lembrete (via lastClosed) decide se ele deve reaparecer — funciona mesmo com fila,
  // pois não depende da transição aberto→fechado (que não ocorre quando o próximo abre em seguida).
  useEffect(() => {
    if (!lastClosed || lastClosed.seq === seenSeq.current) return
    seenSeq.current = lastClosed.seq
    const r = remindersRef.current.find((x) => x.id === lastClosed.id)
    if (!r) return

    // Adiar do destinatário re-alerta; dispensar re-alerta só com autoSnooze; concluir/adiar-dono param.
    const recipientSnooze = lastClosed.outcome === 'snoozed' && !r.mine
    const pesterDismiss = lastClosed.outcome === 'dismiss' && r.autoSnooze
    if (recipientSnooze || pesterDismiss) {
      const n = attempts.current.get(r.id) ?? 0
      if (n < MAX_SNOOZE_ATTEMPTS) {
        const intervalMs = (r.snoozeIntervalMin || 10) * 60_000
        clearTimerFor(r.id)
        timers.current.set(
          r.id,
          setTimeout(() => {
            attempts.current.set(r.id, n + 1)
            timers.current.delete(r.id)
            openTrigger(r.id)
          }, intervalMs),
        )
      } else {
        attempts.current.delete(r.id) // desistiu; zera para uma próxima ocorrência
      }
    } else {
      attempts.current.delete(r.id) // concluído / reagendado pelo dono: encerra
    }
  }, [lastClosed, openTrigger])

  // Limpa todos os timers ao desmontar (logout).
  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((t) => clearTimeout(t))
      map.clear()
    }
  }, [])

  return null
}

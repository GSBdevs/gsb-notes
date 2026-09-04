import { useEffect, useRef } from 'react'
import { useReminders, useSetRemindAt } from '@/hooks/useReminders'
import { nextOccurrence } from '@/lib/reminders'
import { useAppStore } from '@/store/useAppStore'

const HORIZON_MS = 24 * 60 * 60 * 1000 // só agenda timers para as próximas 24h
const CATCHUP_FLOOR_MS = 24 * 60 * 60 * 1000 // catch-up só recupera vencidos das últimas 24h
const LAST_ACTIVE_KEY = 'sb-notas.lastActiveAt'

function readLastActive(): number {
  try {
    const n = Number(localStorage.getItem(LAST_ACTIVE_KEY))
    if (Number.isFinite(n) && n > 0) return n
  } catch {
    /* ignora */
  }
  return Date.now() // primeira vez: sem histórico, nada a recuperar
}
function writeLastActive() {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
  } catch {
    /* ignora */
  }
}

/**
 * Agendador local (Fase 2/3, RF-04/05). Com o app aberto, abre o overlay chamativo quando
 * o `remindAt` chega (o overlay dispara a notificação do SO via platform.notifyNow). Como o
 * `remindAt` sincroniza em todos os clientes (Postgres Changes), cada um dispara o próprio.
 *
 * "App fechado" (Fase 3): CATCH-UP na reabertura/refoco — lembretes que venceram enquanto o
 * app esteve fora (fechado, ou aba em segundo plano com timers estrangulados) são recuperados
 * ao voltar. Escopo: últimas 24h. Entrega REAL a quem está a fim de reabrir.
 *
 * Ainda NÃO coberto: app 100% morto no único dispositivo (web/PWA) → exige Web Push
 * (VAPID + service worker); no desktop Tauri é raro (autostart + bandeja mantêm vivo).
 * Recorrência reagenda a próxima ocorrência ao disparar.
 */
export function ReminderScheduler() {
  const { data: reminders = [], isLoading } = useReminders()
  const openTrigger = useAppStore((s) => s.openTrigger)
  const showToast = useAppStore((s) => s.showToast)
  const setRemindAt = useSetRemindAt()
  const fired = useRef<Set<string>>(new Set())

  // Espelho dos lembretes para os handlers de visibilidade (deps estáveis).
  const remindersRef = useRef(reminders)
  remindersRef.current = reminders

  // Recupera os vencidos-enquanto-fora desde `since` (abre o mais recente; avisa se houver +).
  const runCatchUp = (since: number) => {
    const now = Date.now()
    const floor = now - CATCHUP_FLOOR_MS
    const from = Math.max(since, floor)
    const missed = remindersRef.current.filter((r) => {
      if (r.status === 'archived' || !r.remindAt) return false
      const t = new Date(r.remindAt).getTime()
      const key = `${r.id}:${r.remindAt}`
      return Number.isFinite(t) && t > from && t <= now && !fired.current.has(key)
    })
    if (missed.length === 0) return
    missed.sort((a, b) => new Date(b.remindAt!).getTime() - new Date(a.remindAt!).getTime())
    missed.forEach((r) => fired.current.add(`${r.id}:${r.remindAt}`))
    openTrigger(missed[0].id)
    if (missed.length > 1) {
      showToast(`${missed.length} lembretes venceram enquanto você esteve fora`)
    }
  }

  // Timers para os disparos FUTUROS (próximas 24h), com o app aberto.
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
            const next = nextOccurrence(r.remindAt, r.recurrence, r.recurrenceRule)
            if (next) setRemindAt.mutate({ id: r.id, iso: next })
          }
        }, delay),
      )
    }

    return () => timers.forEach(clearTimeout)
  }, [reminders, openTrigger, setRemindAt])

  // Catch-up na primeira carga (após os dados chegarem).
  const caughtUp = useRef(false)
  useEffect(() => {
    if (caughtUp.current || isLoading) return
    caughtUp.current = true
    runCatchUp(readLastActive())
    writeLastActive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, reminders])

  // Heartbeat de "última atividade" + catch-up ao voltar o foco (aba/janela).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        runCatchUp(readLastActive()) // recupera o que venceu enquanto esteve escondido
        writeLastActive()
      } else {
        writeLastActive() // marca o instante em que saiu
      }
    }
    const hb = setInterval(writeLastActive, 30_000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', writeLastActive)
    return () => {
      clearInterval(hb)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', writeLastActive)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

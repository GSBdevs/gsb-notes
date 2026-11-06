import { useEffect, useRef } from 'react'
import { useReminders, useSetStatus, useSetRemindAt } from '@/hooks/useReminders'
import { useAppStore } from '@/store/useAppStore'
import { notesService } from '@/services/notesService'
import { platform } from '@/platform'

/**
 * Trata os deep links do alarme nativo (Android): a tela cheia abre `sbnotas://alarm/complete?id=…`
 * (Concluir) ou `sbnotas://alarm/snooze?id=…&min=N` (Adiar), e aqui espelhamos exatamente o que o
 * TriggerOverlay faz — dono conclui/reagenda a nota; destinatário registra o recibo. Assim a ação da
 * tela de bloqueio reflete no servidor (resolve a ressalva de "Concluir/Adiar só locais").
 * Só no app nativo; web/desktop = no-op.
 */
export function AlarmActionHandler() {
  const authed = useAppStore((s) => s.authed)
  const showToast = useAppStore((s) => s.showToast)
  const { data: reminders = [] } = useReminders()
  const setStatus = useSetStatus()
  const setRemindAt = useSetRemindAt()
  const pending = useRef<{ action: string; id: string; min: number } | null>(null)
  const remindersRef = useRef(reminders)
  remindersRef.current = reminders

  const run = (action: string, id: string, min: number) => {
    const r = remindersRef.current.find((x) => x.id === id)
    if (!r) {
      pending.current = { action, id, min } // dados ainda não carregaram; reprocessa ao chegar
      return
    }
    if (action === 'complete') {
      if (r.mine) setStatus.mutate({ id, status: 'archived' })
      else void notesService.markResponse(id, 'done')
      showToast('Lembrete concluído')
    } else if (action === 'snooze') {
      if (r.mine) setRemindAt.mutate({ id, iso: new Date(Date.now() + min * 60_000).toISOString() })
      else void notesService.markResponse(id, 'snoozed')
      showToast(`Adiado por ${min} min`)
    }
  }

  const handleUrl = (url: string | null | undefined) => {
    if (!url) return
    const m = url.match(/^sbnotas:\/\/alarm\/(complete|snooze)\?(.*)$/)
    if (!m) return
    const params = new URLSearchParams(m[2])
    const id = params.get('id') || ''
    const min = Number(params.get('min')) || 10
    if (id) run(m[1], id, min)
  }

  useEffect(() => {
    if (!authed || platform.kind !== 'capacitor') return
    let handle: { remove: () => void } | null = null
    void (async () => {
      try {
        const { App } = await import('@capacitor/app')
        const launch = await App.getLaunchUrl() // app aberto frio por um deep link
        if (launch?.url) handleUrl(launch.url)
        handle = await App.addListener('appUrlOpen', (e) => handleUrl(e.url)) // app já aberto
      } catch (e) {
        console.warn('[SBNotas] AlarmActionHandler erro:', e)
      }
    })()
    return () => {
      try {
        handle?.remove()
      } catch {
        /* ignora */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed])

  // Reprocessa a ação pendente assim que os lembretes carregarem (cold start).
  useEffect(() => {
    const p = pending.current
    if (p && reminders.some((x) => x.id === p.id)) {
      pending.current = null
      run(p.action, p.id, p.min)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders])

  return null
}

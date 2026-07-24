import type { Reminder } from '@/types'

/**
 * Interface única da casca nativa. A UI chama estes métodos sem saber a plataforma.
 * - Web/PWA: implementação abaixo (Notification API + overlay in-app).
 * - Windows/Android (Tauri): na Fase 1.5, trocar por uma impl que use janela
 *   always-on-top e @tauri-apps/plugin-notification. Ver docs/03 §7 e handoff §5.
 */
export interface Platform {
  readonly kind: 'web' | 'tauri'
  /** Agenda a notificação nativa do lembrete (no-op quando fora do app, na web). */
  scheduleReminder(reminder: Reminder): Promise<void>
  /** Pede permissão de notificação, se aplicável. Retorna se foi concedida. */
  requestNotificationPermission(): Promise<boolean>
  /** Dispara a notificação do SO agora (o overlay in-app é responsabilidade da UI). */
  notifyNow(reminder: Reminder): void
}

const webPlatform: Platform = {
  kind: 'web',
  async requestNotificationPermission() {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const res = await Notification.requestPermission()
    return res === 'granted'
  },
  async scheduleReminder() {
    // Na web sem service worker de background, o agendamento vive num timer do app.
    // O agendamento real (mesmo com app fechado) chega com a casca Tauri.
  },
  notifyNow(reminder) {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('SB Notas — Lembrete agora', { body: reminder.title })
      }
    } catch {
      /* silencioso: o overlay in-app já cobre o feedback visual */
    }
  },
}

export const platform: Platform = webPlatform

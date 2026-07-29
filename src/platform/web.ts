import type { Platform } from './types'

/** Implementação web/PWA: Notification API do navegador + overlay in-app (UI). */
export const webPlatform: Platform = {
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
    // Na web não há janela nativa; `alwaysOnTop` é ignorado (o overlay in-app cobre).
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('SB Notas — Lembrete agora', { body: reminder.title })
      }
    } catch {
      /* silencioso: o overlay in-app já cobre o feedback visual */
    }
  },
  async setAutostart() {
    // Navegador não inicia com o SO. No-op.
  },
  async isAutostartEnabled() {
    return false
  },
}

import type { Platform } from './types'
import type { Reminder } from '@/types'

/**
 * Implementação Android (Capacitor). Usa `@capacitor/local-notifications` para notificações
 * nativas do SO — inclusive agendadas para quando o app está fechado (o alarme do RF-06).
 * Os plugins são carregados via import dinâmico, então o bundle web/Tauri não os embarca.
 * "Always-on-top" não existe no mobile: a notificação do SO + o overlay in-app cobrem o disparo.
 */

/** Id numérico estável (int 32 bits) a partir do UUID da nota — o plugin exige number. */
function numId(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 2_000_000_000
}

async function ln() {
  const mod = await import('@capacitor/local-notifications')
  return mod.LocalNotifications
}

export const capacitorPlatform: Platform = {
  kind: 'capacitor',

  async requestNotificationPermission() {
    try {
      const LocalNotifications = await ln()
      const res = await LocalNotifications.requestPermissions()
      return res.display === 'granted'
    } catch {
      return false
    }
  },

  async scheduleReminder(reminder: Reminder) {
    if (!reminder.remindAt) return
    const at = new Date(reminder.remindAt)
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return
    try {
      const LocalNotifications = await ln()
      await LocalNotifications.schedule({
        notifications: [
          {
            id: numId(reminder.id),
            title: reminder.title || 'Lembrete',
            body: reminder.body || 'Toque para abrir no SB Notas',
            schedule: { at },
          },
        ],
      })
    } catch {
      /* sem permissão / plugin indisponível: o agendador in-app ainda cobre com o app aberto */
    }
  },

  notifyNow(reminder: Reminder) {
    void (async () => {
      try {
        const LocalNotifications = await ln()
        await LocalNotifications.schedule({
          notifications: [
            {
              id: numId(reminder.id) + 1,
              title: 'SB Notas — Lembrete agora',
              body: reminder.title || '',
            },
          ],
        })
      } catch {
        /* silencioso: o overlay in-app já dá o feedback visual */
      }
    })()
  },

  async setAutostart() {
    // Início com o SO é conceito de desktop; no Android, não se aplica. No-op.
  },

  async isAutostartEnabled() {
    return false
  },

  async checkForUpdate() {
    // Android atualiza pela loja / APK; não há updater embutido como no Tauri.
    return null
  },
}

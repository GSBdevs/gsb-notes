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

/** Canais de notificação (Android 8+). Fixados vão num canal silencioso, separado dos disparos. */
const CH_REMINDERS = 'reminders'
const CH_PINNED = 'pinned'

async function ln() {
  const mod = await import('@capacitor/local-notifications')
  return mod.LocalNotifications
}

/**
 * Cria os canais uma vez (idempotente — recriar com o mesmo id só atualiza os metadados).
 * `reminders`: alta importância, com som/vibração (o alarme do lembrete).
 * `pinned`: baixa importância, sem som/vibração — a notificação persistente do item fixado não incomoda.
 */
let channelsReady: Promise<void> | null = null
function ensureChannels(): Promise<void> {
  if (channelsReady) return channelsReady
  channelsReady = (async () => {
    try {
      const LocalNotifications = await ln()
      await LocalNotifications.createChannel({
        id: CH_REMINDERS,
        name: 'Lembretes',
        description: 'Alarmes dos seus lembretes',
        importance: 5,
        visibility: 1,
        vibration: true,
      })
      await LocalNotifications.createChannel({
        id: CH_PINNED,
        name: 'Fixados',
        description: 'Lembretes e tarefas fixados, sempre à vista na barra',
        importance: 2,
        visibility: 1,
        vibration: false,
      })
    } catch {
      /* plugin indisponível / não-Android: segue sem canais */
    }
  })()
  return channelsReady
}

export const capacitorPlatform: Platform = {
  kind: 'capacitor',

  async requestNotificationPermission() {
    try {
      const LocalNotifications = await ln()
      const res = await LocalNotifications.requestPermissions()
      void ensureChannels() // cria os canais assim que houver permissão
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
      await ensureChannels()
      await LocalNotifications.schedule({
        notifications: [
          {
            id: numId(reminder.id),
            title: reminder.title || 'Lembrete',
            body: reminder.body || 'Toque para abrir no SB Notas',
            channelId: CH_REMINDERS,
            schedule: { at },
          },
        ],
      })
    } catch {
      /* sem permissão / plugin indisponível: o agendador in-app ainda cobre com o app aberto */
    }
  },

  async cancelReminder(reminderId: string) {
    try {
      const LocalNotifications = await ln()
      await LocalNotifications.cancel({ notifications: [{ id: numId(reminderId) }] })
    } catch {
      /* plugin indisponível / nada agendado */
    }
  },

  // Notificação PERSISTENTE do item fixado: fica na barra, não desliza (ongoing), sem auto-cancelar
  // ao tocar, no canal silencioso. Id próprio ('pin:') p/ não colidir com o alarme agendado do mesmo item.
  async pinReminder(reminder: Reminder) {
    try {
      const LocalNotifications = await ln()
      await ensureChannels()
      const isTask = reminder.kind === 'doc'
      await LocalNotifications.schedule({
        notifications: [
          {
            id: numId('pin:' + reminder.id),
            title: reminder.title || (isTask ? 'Tarefa' : 'Lembrete'),
            body: reminder.body || (isTask ? 'Tarefa fixada' : 'Lembrete fixado'),
            channelId: CH_PINNED,
            ongoing: true, // não pode ser deslizada
            autoCancel: false, // continua na barra após o toque
            extra: { noteId: reminder.id },
          },
        ],
      })
    } catch {
      /* silencioso: sem permissão / plugin indisponível */
    }
  },

  async unpinReminder(reminderId: string) {
    try {
      const LocalNotifications = await ln()
      await LocalNotifications.cancel({ notifications: [{ id: numId('pin:' + reminderId) }] })
    } catch {
      /* plugin indisponível / nada fixado */
    }
  },

  notifyNow(reminder: Reminder) {
    void (async () => {
      try {
        const LocalNotifications = await ln()
        await ensureChannels()
        await LocalNotifications.schedule({
          notifications: [
            {
              id: numId(reminder.id) + 1,
              title: 'SB Notas — Lembrete agora',
              body: reminder.title || '',
              channelId: CH_REMINDERS,
            },
          ],
        })
      } catch {
        /* silencioso: o overlay in-app já dá o feedback visual */
      }
    })()
  },

  notify(title: string, body: string) {
    void (async () => {
      try {
        const LocalNotifications = await ln()
        await ensureChannels()
        await LocalNotifications.schedule({
          notifications: [
            { id: Math.floor(Math.random() * 2_000_000_000), title, body, channelId: CH_REMINDERS },
          ],
        })
      } catch {
        /* silencioso */
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

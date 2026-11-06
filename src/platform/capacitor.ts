import { CapacitorHttp } from '@capacitor/core'
import type { Platform } from './types'
import type { Reminder } from '@/types'

/**
 * Manifesto do auto-update Android (mesmo GitHub Releases do updater do Windows). O dono sobe junto ao
 * release um `android-latest.json` = { version, notes, url(apk) }. Buscado por CapacitorHttp (nativo,
 * sem CORS). Ver UpdaterPlugin.java / nativeUpdater.ts / internal/docs/15.
 */
const ANDROID_UPDATE_MANIFEST =
  'https://github.com/GSBdevs/gsb-notes/releases/latest/download/android-latest.json'

/** Compara versões "a.b.c" numericamente. true se `remote` for maior que `local`. */
function isNewerVersion(remote: string, local: string): boolean {
  const a = remote.split('.').map((n) => parseInt(n, 10) || 0)
  const b = local.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

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

// IMPORTANTE: retornamos o NAMESPACE do módulo, não `mod.LocalNotifications`. O plugin é um Proxy do
// Capacitor; se ele for o valor de resolução de uma Promise, o `await` chama `.then()` nele e o
// nativo lança "LocalNotifications.then() is not implemented on android". Extraímos o plugin DEPOIS
// do await (`const { LocalNotifications } = await ln()`), nunca resolvendo uma Promise com o proxy.
async function ln() {
  return await import('@capacitor/local-notifications')
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
      const { LocalNotifications } = await ln()
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
      const { LocalNotifications } = await ln()
      const res = await LocalNotifications.requestPermissions()
      void ensureChannels() // cria os canais assim que houver permissão
      return res.display === 'granted'
    } catch {
      return false
    }
  },

  async checkNotificationPermission() {
    try {
      const { LocalNotifications } = await ln()
      const res = await LocalNotifications.checkPermissions()
      // O plugin devolve 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied'.
      if (res.display === 'granted') return 'granted'
      if (res.display === 'denied') return 'denied'
      return 'prompt'
    } catch {
      return 'unsupported'
    }
  },

  async scheduleReminder(
    reminder: Reminder,
    opts?: { soundUri?: string | null; accent?: string | null },
  ) {
    if (!reminder.remindAt) return
    const at = new Date(reminder.remindAt)
    if (Number.isNaN(at.getTime()) || at.getTime() <= Date.now()) return

    // 1) ALARME NATIVO (estilo relógio): tela cheia + som contínuo + vibração. Se o plugin ainda não
    //    estiver buildado no APK, cai no fallback da notificação local (comportamento anterior).
    try {
      const { Alarm } = await import('./nativeAlarm')
      await Alarm.schedule({
        id: numId(reminder.id),
        noteId: reminder.id,
        at: at.getTime(),
        title: reminder.title || 'Lembrete',
        body: reminder.body || 'Toque para abrir no SB Notas',
        color: reminder.color,
        priority: reminder.priority,
        snoozeMin: reminder.snoozeIntervalMin || 10,
        soundUri: opts?.soundUri || '',
        accent: opts?.accent || '',
      })
      return
    } catch {
      /* plugin nativo ausente/erro → fallback abaixo */
    }

    // 2) Fallback: notificação local agendada (allowWhileIdle p/ furar o Doze).
    try {
      const { LocalNotifications } = await ln()
      await ensureChannels()
      await LocalNotifications.schedule({
        notifications: [
          {
            id: numId(reminder.id),
            title: reminder.title || 'Lembrete',
            body: reminder.body || 'Toque para abrir no SB Notas',
            channelId: CH_REMINDERS,
            schedule: { at, allowWhileIdle: true },
          },
        ],
      })
    } catch {
      /* sem permissão / plugin indisponível: o agendador in-app ainda cobre com o app aberto */
    }
  },

  async cancelReminder(reminderId: string) {
    // Cancela nos dois caminhos (alarme nativo + notificação local do fallback).
    try {
      const { Alarm } = await import('./nativeAlarm')
      await Alarm.cancel({ id: numId(reminderId) })
    } catch {
      /* plugin nativo ausente */
    }
    try {
      const { LocalNotifications } = await ln()
      await LocalNotifications.cancel({ notifications: [{ id: numId(reminderId) }] })
    } catch {
      /* plugin indisponível / nada agendado */
    }
  },

  // Notificação PERSISTENTE do item fixado: fica na barra, não desliza (ongoing), sem auto-cancelar
  // ao tocar, no canal silencioso. Id próprio ('pin:') p/ não colidir com o alarme agendado do mesmo item.
  async pinReminder(reminder: Reminder) {
    try {
      const { LocalNotifications } = await ln()
      await ensureChannels()
      const isTask = reminder.kind === 'doc'
      // Detalhes na notificação: prioridade · horário (1ª linha) + corpo (expansível com BigText).
      // O "Fixado" vira um selo discreto (summaryText), em vez de ocupar a linha principal.
      const pinned = isTask ? 'Tarefa fixada' : 'Lembrete fixado'
      const prio =
        reminder.priority === 'urgent'
          ? 'Urgente'
          : reminder.priority === 'important'
            ? 'Importante'
            : 'Normal'
      const meta = [prio, reminder.remindAt ? reminder.time : null].filter(Boolean).join(' · ')
      const content = (reminder.body || '').trim()
      const lines = [meta, content].filter(Boolean).join('\n')
      await LocalNotifications.schedule({
        notifications: [
          {
            id: numId('pin:' + reminder.id),
            title: reminder.title || (isTask ? 'Tarefa' : 'Lembrete'),
            body: lines || pinned, // 1ª linha (recolhida)
            largeBody: lines || pinned, // texto expandido (BigTextStyle)
            summaryText: pinned, // selo discreto "Fixado"
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
      const { LocalNotifications } = await ln()
      await LocalNotifications.cancel({ notifications: [{ id: numId('pin:' + reminderId) }] })
    } catch {
      /* plugin indisponível / nada fixado */
    }
  },

  notifyNow(reminder: Reminder) {
    void (async () => {
      try {
        const { LocalNotifications } = await ln()
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
        const { LocalNotifications } = await ln()
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

  async pickAlarmSound(currentUri?: string | null) {
    try {
      const { Alarm } = await import('./nativeAlarm')
      const res = await Alarm.pickSound({ currentUri: currentUri || undefined })
      if (res.cancelled) return null
      return { uri: res.uri, name: res.name }
    } catch {
      return null
    }
  },

  async setAutostart() {
    // Início com o SO é conceito de desktop; no Android, não se aplica. No-op.
  },

  async isAutostartEnabled() {
    return false
  },

  async checkForUpdate() {
    // Auto-update por APK SEM Play Store: compara a versão instalada com o manifesto do GitHub
    // Releases; se houver versão nova, devolve um AppUpdate que baixa+instala pelo plugin nativo.
    // Qualquer erro (fora do Android, sem rede, manifesto ausente) → null (não trava o app).
    try {
      const { Updater } = await import('./nativeUpdater')
      const { version: current } = await Updater.getVersion()
      const res = await CapacitorHttp.get({
        url: ANDROID_UPDATE_MANIFEST,
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (res.status < 200 || res.status >= 300) return null
      const m = (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) as {
        version?: string
        notes?: string
        url?: string
      }
      if (!m?.version || !m?.url || !isNewerVersion(m.version, current)) return null
      const apkUrl = m.url
      return {
        version: m.version,
        notes: m.notes,
        async downloadAndInstall(onProgress?: (percent: number) => void) {
          const { Updater } = await import('./nativeUpdater')
          // Sem a permissão "instalar apps desconhecidos" o instalador nem abre → leva o usuário à
          // tela do sistema e pede pra tentar de novo (ele habilita uma vez, por app).
          const can = await Updater.canInstall()
          if (!can.granted) {
            await Updater.openInstallSettings()
            throw new Error('Permita instalar apps do SB Notas e toque em Instalar novamente.')
          }
          let handle: { remove: () => Promise<void> } | undefined
          if (onProgress) {
            handle = await Updater.addListener('downloadProgress', (d) => onProgress(d.percent))
          }
          try {
            await Updater.downloadAndInstall({ url: apkUrl })
          } finally {
            await handle?.remove()
          }
        },
      }
    } catch {
      return null
    }
  },
}

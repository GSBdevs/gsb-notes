import { registerPlugin } from '@capacitor/core'
import type { Platform } from './types'
import type { Reminder } from '@/types'

/** Ponte para o plugin nativo (Kotlin/Java) que dispara o instalador de APK do Android. */
interface ApkInstallerPlugin {
  install(options: { path: string }): Promise<void>
}
const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller')

/** Manifesto de atualização Android publicado no GitHub Releases (versão + URL do APK + notas). */
const ANDROID_MANIFEST_URL =
  'https://github.com/GSBdevs/gsb-notes/releases/latest/download/latest-android.json'

/** Compara versões "x.y.z": 1 se a>b, -1 se a<b, 0 se iguais. */
function cmpVer(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  return 0
}

/** Uint8Array → base64 (em blocos, p/ não estourar a pilha com APKs de alguns MB). */
function base64FromBytes(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Baixa o APK (com progresso 0–100), grava no cache e dispara o instalador nativo. */
async function downloadAndInstallApk(url: string, onProgress?: (p: number) => void): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error('download falhou')
  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.length
      if (total > 0) onProgress?.(Math.round((received / total) * 100))
    }
  }
  const buf = new Uint8Array(received)
  let off = 0
  for (const c of chunks) {
    buf.set(c, off)
    off += c.length
  }
  const fileName = `sb-notas-update-${Date.now()}.apk`
  const written = await Filesystem.writeFile({
    path: fileName,
    data: base64FromBytes(buf),
    directory: Directory.Cache,
  })
  onProgress?.(100)
  // O nativo transforma o file:// num content:// via FileProvider e abre o instalador do Android.
  await ApkInstaller.install({ path: written.uri })
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
    // Auto-update por APK sideloaded: lê o manifesto no GitHub Releases, compara com a versão
    // instalada e, se houver nova, devolve o AppUpdate (o UpdateBanner baixa + instala). Erros → null.
    try {
      const { App } = await import('@capacitor/app')
      const info = await App.getInfo()
      const res = await fetch(ANDROID_MANIFEST_URL, { cache: 'no-store' })
      if (!res.ok) return null
      const manifest = (await res.json()) as { version?: string; notes?: string; apk?: string }
      if (!manifest.version || !manifest.apk) return null
      if (cmpVer(manifest.version, info.version) <= 0) return null
      const apkUrl = manifest.apk
      return {
        version: manifest.version,
        notes: manifest.notes,
        async downloadAndInstall(onProgress?: (p: number) => void) {
          await downloadAndInstallApk(apkUrl, onProgress)
        },
      }
    } catch {
      return null
    }
  },
}

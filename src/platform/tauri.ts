import type { Platform } from './types'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart'
import { getCurrentWindow } from '@tauri-apps/api/window'

async function ensurePermission(): Promise<boolean> {
  let granted = await isPermissionGranted()
  if (!granted) granted = (await requestPermission()) === 'granted'
  return granted
}

/**
 * Implementação Tauri (Windows/Android). Cobre os dois recursos-chave:
 * - Notificação do SO que aparece mesmo com o app minimizado/na bandeja.
 * - Traz a janela para frente por cima de tudo (o overlay chamativo nativo).
 */
export const tauriPlatform: Platform = {
  kind: 'tauri',
  async requestNotificationPermission() {
    return ensurePermission()
  },
  async scheduleReminder() {
    // Agendamento persistente (disparo com o processo encerrado) entra numa etapa
    // futura via alarme nativo. Hoje o app vive na bandeja e o timer da UI dispara
    // enquanto o processo estiver ativo (minimizado inclusive).
  },
  notifyNow(reminder, opts) {
    // 1) Notificação do SO — visível mesmo minimizado/na bandeja.
    void (async () => {
      try {
        if (await ensurePermission()) {
          sendNotification({ title: 'SB Notas — Lembrete agora', body: reminder.title })
        }
      } catch {
        /* silencioso */
      }
    })()
    // 2) Overlay chamativo nativo: só se "sempre no topo" estiver ligado (settings.ontop).
    if (opts?.alwaysOnTop ?? true) {
      void (async () => {
        try {
          const w = getCurrentWindow()
          await w.unminimize()
          await w.show()
          await w.setAlwaysOnTop(true)
          await w.setFocus()
        } catch {
          /* silencioso */
        }
      })()
    }
  },
  async setAutostart(enabled) {
    try {
      if (enabled) await enable()
      else await disable()
    } catch {
      /* silencioso */
    }
  },
  async isAutostartEnabled() {
    try {
      return await isEnabled()
    } catch {
      return false
    }
  },
  dismissTrigger() {
    // Ao fechar o overlay, solta o always-on-top para não prender a janela na frente.
    void (async () => {
      try {
        await getCurrentWindow().setAlwaysOnTop(false)
      } catch {
        /* silencioso */
      }
    })()
  },
}

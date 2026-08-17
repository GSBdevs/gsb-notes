import type { Reminder } from '@/types'

/** Atualização disponível do app nativo (Tauri). `downloadAndInstall` relança ao final. */
export interface AppUpdate {
  version: string
  notes?: string
  downloadAndInstall(onProgress?: (percent: number) => void): Promise<void>
}

/**
 * Interface única da casca nativa. A UI chama estes métodos sem saber a plataforma.
 * - Web/PWA: `web.ts` (Notification API + overlay in-app).
 * - Windows/Android (Tauri): `tauri.ts` (janela always-on-top + plugin-notification).
 * A implementação certa é escolhida em `index.ts` conforme o ambiente.
 */
export interface Platform {
  readonly kind: 'web' | 'tauri'
  /** Agenda a notificação nativa do lembrete (no-op na web sem service worker). */
  scheduleReminder(reminder: Reminder): Promise<void>
  /** Pede permissão de notificação, se aplicável. Retorna se foi concedida. */
  requestNotificationPermission(): Promise<boolean>
  /**
   * Dispara a notificação do SO agora e (se `alwaysOnTop`) traz o app para frente
   * por cima de tudo — o overlay chamativo nativo. `alwaysOnTop` padrão = true.
   */
  notifyNow(reminder: Reminder, opts?: { alwaysOnTop?: boolean }): void
  /** Chamado quando o overlay de disparo fecha. Na casca nativa, tira o always-on-top. */
  dismissTrigger?(): void
  /** Liga/desliga o início com o SO. Web: no-op. */
  setAutostart(enabled: boolean): Promise<void>
  /** Estado real do início com o SO (fonte da verdade). Web: sempre false. */
  isAutostartEnabled(): Promise<boolean>
  /**
   * Procura uma atualização do app. Tauri: consulta o endpoint do updater. Web/PWA: `null`
   * (a atualização vem pelo service worker — basta recarregar). Erros → `null` (não trava o app).
   */
  checkForUpdate(): Promise<AppUpdate | null>
}

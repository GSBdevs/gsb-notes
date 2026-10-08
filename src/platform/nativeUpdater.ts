import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

/**
 * Ponte para o plugin nativo "Updater" (Android) — auto-update por APK SEM Play Store. Baixa o APK de
 * uma URL e chama o instalador do sistema (o usuário confirma). Implementação nativa em
 * `android/app/src/main/java/com/gsbdevs/sbnotas/UpdaterPlugin.java`. Fora do Android os métodos
 * rejeitam (plugin não implementado) — o capacitor.ts trata e devolve `null` no checkForUpdate.
 */
export interface UpdaterPlugin {
  /** Versão instalada (versionName) + versionCode, para comparar com o manifesto do release. */
  getVersion(): Promise<{ version: string; code: number }>
  /** Android 8+: o usuário já permitiu que o SB Notas instale apps? (abaixo disso, sempre true). */
  canInstall(): Promise<{ granted: boolean }>
  /** Abre a tela do sistema "Instalar apps desconhecidos" para o nosso app. */
  openInstallSettings(): Promise<void>
  /** Baixa o APK de `url` e lança o instalador. Progresso via evento "downloadProgress". */
  downloadAndInstall(options: { url: string }): Promise<void>
  /** Progresso do download (0–100). */
  addListener(
    eventName: 'downloadProgress',
    listener: (data: { percent: number }) => void,
  ): Promise<PluginListenerHandle>
}

export const Updater = registerPlugin<UpdaterPlugin>('Updater')

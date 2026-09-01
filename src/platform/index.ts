import type { Platform } from './types'
import { webPlatform } from './web'
import { tauriPlatform } from './tauri'
import { capacitorPlatform } from './capacitor'

export type { Platform, AppUpdate } from './types'

/** Tauri 2 injeta `__TAURI_INTERNALS__` no window; a ausência = rodando na web. */
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
/** Capacitor injeta `window.Capacitor` no WebView nativo (Android). */
const isCapacitor =
  typeof window !== 'undefined' &&
  !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

export const platform: Platform = isTauri
  ? tauriPlatform
  : isCapacitor
    ? capacitorPlatform
    : webPlatform

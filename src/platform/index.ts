import type { Platform } from './types'
import { webPlatform } from './web'
import { tauriPlatform } from './tauri'

export type { Platform, AppUpdate } from './types'

/** Tauri 2 injeta `__TAURI_INTERNALS__` no window; a ausência = rodando na web. */
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const platform: Platform = isTauri ? tauriPlatform : webPlatform

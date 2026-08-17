import { useSyncExternalStore } from 'react'
import { onlineManager } from '@tanstack/react-query'

/**
 * Estado de conexão (fonte: onlineManager do TanStack Query, que espelha navigator.onLine +
 * eventos online/offline). Reage em tempo real. No SSR/sem window, assume online.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  )
}

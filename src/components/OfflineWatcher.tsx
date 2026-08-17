import { useEffect, useRef } from 'react'
import { useOnline } from '@/hooks/useOnline'
import { useAppStore } from '@/store/useAppStore'

/** Avisa por toast quando a conexão cai/volta. As mutações pausadas resumem sozinhas ao reconectar. */
export function OfflineWatcher() {
  const online = useOnline()
  const showToast = useAppStore((s) => s.showToast)
  const prev = useRef(online)

  useEffect(() => {
    if (prev.current === online) return
    prev.current = online
    showToast(
      online
        ? 'De volta online — sincronizando'
        : 'Você está offline — as mudanças sincronizam ao reconectar',
    )
  }, [online, showToast])

  return null
}

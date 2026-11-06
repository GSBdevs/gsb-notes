import { useEffect, useState } from 'react'
import { platform, type AppUpdate } from '@/platform'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@/components/ui/Icon'

/**
 * Banner de atualização do app nativo (Tauri). Verifica no início; se houver versão nova,
 * oferece instalar direto do app (baixa, instala e relança). Na web/PWA nunca aparece
 * (`checkForUpdate` retorna null — lá a atualização vem pelo service worker ao recarregar).
 */
export function UpdateBanner() {
  const [update, setUpdate] = useState<AppUpdate | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState<number | null>(null)
  const showToast = useAppStore((s) => s.showToast)

  // Verifica ao abrir E periodicamente (a cada 3h) + ao focar a janela. Sem isso, um app que fica
  // aberto na bandeja/autostart só checava no boot e NUNCA pegava uma release nova (causa de "alguns
  // apps não atualizam sozinhos"). Não re-checa enquanto estiver instalando ou já com update em mão.
  useEffect(() => {
    let alive = true
    let lastCheck = 0
    const CHECK_EVERY = 3 * 60 * 60 * 1000 // 3h
    const FOCUS_THROTTLE = 30 * 60 * 1000 // no máx. 1 check por foco a cada 30min

    const run = () => {
      lastCheck = Date.now()
      platform
        .checkForUpdate()
        .then((u) => {
          if (alive && u) setUpdate((cur) => cur ?? u)
        })
        .catch(() => {})
    }

    run()
    const iv = setInterval(run, CHECK_EVERY)
    const onFocus = () => {
      if (Date.now() - lastCheck > FOCUS_THROTTLE) run()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      clearInterval(iv)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  if (!update || dismissed) return null

  const install = async () => {
    setBusy(true)
    setPct(0)
    try {
      await update.downloadAndInstall((p) => setPct(p))
      // Em caso de sucesso o app relança; se chegar aqui, algo interrompeu.
    } catch {
      showToast('Não foi possível atualizar agora. Tente mais tarde.')
      setBusy(false)
      setPct(null)
    }
  }

  return (
    <div
      className="fixed left-1/2 z-[70] flex w-[min(440px,calc(100vw-24px))] -translate-x-1/2 items-center gap-3 rounded-xl border border-accent/40 bg-bg-elevated-2/95 px-4 py-3 shadow-pop backdrop-blur-md"
      style={{ bottom: 18 }}
      role="status"
    >
      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-accent-surface text-accent-ink">
        <Icon name="sparkles" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">Atualização {update.version} disponível</div>
        <div className="truncate text-[12.5px] text-text-muted">
          {busy ? `Baixando… ${pct ?? 0}%` : 'Instale para ter as novidades e correções.'}
        </div>
      </div>
      {busy ? (
        <Icon name="loader-2" size={18} className="animate-spin text-accent-ink" />
      ) : (
        <>
          <button
            onClick={() => setDismissed(true)}
            className="h-9 rounded-md border border-border bg-transparent px-3 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Depois
          </button>
          <button
            onClick={install}
            className="h-9 rounded-md bg-accent px-3.5 text-[13px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
          >
            Instalar
          </button>
        </>
      )}
    </div>
  )
}

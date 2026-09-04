import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

/**
 * Tema customizável (Fase 4): aplica a cor de destaque escolhida nos tokens CSS.
 * A identidade continua dark — só o ACENTO muda. Derivados (hover/soft/surface/glow)
 * são calculados via color-mix/alpha para manter o mesmo sistema visual do âmbar.
 */
export function ThemeApplier() {
  const accent = useAppStore((s) => s.settings.accent)
  const scale = useAppStore((s) => s.settings.scale)
  const theme = useAppStore((s) => s.settings.theme)

  useEffect(() => {
    const root = document.documentElement.style
    const hex = accent || '#FACC15'
    root.setProperty('--accent', hex)
    root.setProperty('--accent-hover', `color-mix(in srgb, ${hex} 85%, #000)`)
    root.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 70%, #fff)`)
    root.setProperty('--accent-glow', `${hex}59`) // ~35% alpha
    root.setProperty('--accent-surface', `${hex}1a`) // ~10% alpha
  }, [accent])

  // Escala da interface: aplica zoom no documento (Chromium — WebView2/Chrome/Android).
  useEffect(() => {
    const n = typeof scale === 'number' && scale > 0 ? scale : 1
    ;(document.documentElement.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(n)
  }, [scale])

  // Tema claro/escuro/sistema: só o claro marca `data-theme="light"` (escuro é o padrão do :root).
  // Em "sistema", segue o prefers-color-scheme e reage a mudanças do SO.
  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const apply = () => {
      const light = theme === 'light' || (theme === 'system' && mq.matches)
      if (light) root.setAttribute('data-theme', 'light')
      else root.removeAttribute('data-theme')
    }
    apply()
    if (theme === 'system') {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
  }, [theme])

  return null
}

import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

/**
 * Tema customizável (Fase 4): aplica a cor de destaque escolhida nos tokens CSS.
 * A identidade continua dark — só o ACENTO muda. Derivados (hover/soft/surface/glow)
 * são calculados via color-mix/alpha para manter o mesmo sistema visual do âmbar.
 */
export function ThemeApplier() {
  const accent = useAppStore((s) => s.settings.accent)

  useEffect(() => {
    const root = document.documentElement.style
    const hex = accent || '#FACC15'
    root.setProperty('--accent', hex)
    root.setProperty('--accent-hover', `color-mix(in srgb, ${hex} 85%, #000)`)
    root.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 70%, #fff)`)
    root.setProperty('--accent-glow', `${hex}59`) // ~35% alpha
    root.setProperty('--accent-surface', `${hex}1a`) // ~10% alpha
  }, [accent])

  return null
}

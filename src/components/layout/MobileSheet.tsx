import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'

/**
 * Folha inferior (bottom sheet) do shell MOBILE — usada pelos menus "Criar" (FAB) e "Mais" da
 * barra inferior. Desliza de baixo, com scrim e alça; fecha no scrim, no Esc ou ao escolher um item.
 * Só mobile (`md:hidden`); o desktop usa a sidebar e não a renderiza. Espelha o mockup aprovado
 * (scratchpad/sbnotas-android-mockup.html). Mantida leve (Framer Motion, já na stack) em vez de
 * trazer uma lib de drawer — não fecha portas para uma eventual migração ao Ionic.
 */
export function MobileSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  // Esc fecha (teclado físico/externo no Android; e paridade com os modais do app).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end bg-black/50 md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            className="w-full rounded-t-[18px] border-t border-border bg-bg-elevated px-3 pt-2.5"
            style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2.5 mt-0.5 h-1 w-9 rounded-full bg-border-strong" />
            <h3 className="mb-2 px-1 text-xs font-bold uppercase tracking-[.08em] text-text-muted">{title}</h3>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Linha de ação dentro da folha: ícone (acento) + rótulo + seta opcional (navegação). */
export function SheetRow({
  icon,
  label,
  arrow,
  onClick,
}: {
  icon: string
  label: string
  arrow?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-3 text-left text-sm font-semibold text-text-primary transition-colors hover:bg-bg-elevated-2 active:bg-bg-elevated-2"
    >
      <Icon name={icon} size={20} style={{ color: 'var(--accent-ink)' }} />
      <span className="flex-1">{label}</span>
      {arrow && <Icon name="chevron-right" size={18} style={{ color: 'var(--text-muted)' }} />}
    </button>
  )
}

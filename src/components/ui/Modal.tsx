import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Icon } from './Icon'

/** Shell de modal centrado (desktop) / tela cheia (mobile). Fecha no backdrop e no X. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  maxWidth = 440,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: number
}) {
  // Só fecha se o clique começou E terminou no backdrop — evita fechar quando o
  // usuário arrasta uma seleção de dentro do modal e solta o mouse fora dele.
  const pressedOnBackdrop = useRef(false)

  return (
    <div
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedOnBackdrop.current) onClose()
      }}
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxWidth }}
        className="flex max-h-screen w-full flex-col overflow-hidden border border-border bg-bg-surface shadow-pop md:max-h-[92vh] md:rounded-[18px]"
      >
        <div className="flex items-center border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <div className="flex-1" />
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid place-items-center text-text-muted transition-colors hover:text-text-primary"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center gap-2.5 border-t border-border px-5 py-3.5">{footer}</div>
        )}
      </motion.div>
    </div>
  )
}

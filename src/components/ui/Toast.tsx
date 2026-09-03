import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from './Icon'

export function Toast() {
  const toast = useAppStore((s) => s.toast)
  const dismissToast = useAppStore((s) => s.dismissToast)

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="fixed left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2.5 rounded-md border border-border-strong bg-bg-elevated-2 py-3 pl-[18px] pr-3 text-sm font-medium shadow-pop"
          style={{ bottom: 28 }}
        >
          <Icon name="check-circle" size={16} style={{ color: 'var(--success)' }} />
          <span>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.run()
                dismissToast()
              }}
              className="ml-1 rounded px-2.5 py-1 text-[13px] font-bold text-accent-ink transition-colors hover:bg-accent-surface"
            >
              {toast.action.label}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

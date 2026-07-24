import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from './Icon'

export function Toast() {
  const toast = useAppStore((s) => s.toast)
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="fixed left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2.5 rounded-md border border-border-strong bg-bg-elevated-2 px-[18px] py-3 text-sm font-medium shadow-pop"
          style={{ bottom: 28 }}
        >
          <Icon name="check-circle" size={16} style={{ color: 'var(--success)' }} />
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

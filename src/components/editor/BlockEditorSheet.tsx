import { lazy, Suspense } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useReminders } from '@/hooks/useReminders'

// O editor BlockNote é pesado → carregado sob demanda (chunk próprio).
const BlockEditorInner = lazy(() => import('./BlockEditorInner'))

/** Monta o editor de blocos em tela cheia quando há um bloco aberto (store.blockId). */
export function BlockEditorSheet() {
  const blockId = useAppStore((s) => s.blockId)
  const closeBlock = useAppStore((s) => s.closeBlock)
  const { data: reminders = [] } = useReminders()

  if (!blockId) return null
  const block = reminders.find((r) => r.id === blockId)
  if (!block) return null

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-40 grid place-items-center bg-bg-surface text-sm text-text-muted">
          Abrindo editor…
        </div>
      }
    >
      <BlockEditorInner block={block} onClose={closeBlock} />
    </Suspense>
  )
}

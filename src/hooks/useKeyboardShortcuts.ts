import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

function isTyping(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null
  if (!node) return false
  const tag = node.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable
}

/**
 * Atalhos globais (desktop): "N" abre um novo lembrete (captura rápida em 1 tecla),
 * "Esc" fecha o overlay aberto. Ignora quando o foco está num campo de texto.
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useAppStore.getState()

      if (e.key === 'Escape') {
        if (s.editorOpen) {
          s.closeEditor()
          e.preventDefault()
        } else if (s.taskOpen) {
          s.closeTask()
          e.preventDefault()
        } else if (s.viewId) {
          s.closeView()
          e.preventDefault()
        } else if (s.triggerOpen) {
          s.closeTrigger()
          e.preventDefault()
        }
        return
      }

      const canGlobal =
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !isTyping(e.target) &&
        s.authed &&
        !s.editorOpen &&
        !s.taskOpen &&
        !s.viewId &&
        !s.triggerOpen

      if ((e.key === 'n' || e.key === 'N') && canGlobal) {
        s.openEditor(null)
        e.preventDefault()
      }

      // "/" foca a busca do mural (padrão Linear/GitHub), se estiver na tela.
      if (e.key === '/' && canGlobal) {
        const el = document.getElementById('mural-search') as HTMLInputElement | null
        if (el) {
          el.focus()
          el.select()
          e.preventDefault()
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

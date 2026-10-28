import { useEffect, useRef, useState } from 'react'
import type { ChecklistItem } from '@/types'
import { Icon } from '@/components/ui/Icon'

/**
 * Bolinha de um item de checklist com DESFECHO (0036): ao concluir, escolhe ✓ feito (verde) ou
 * ✗ não feito (vermelho). Os dois contam como resolvido para a auto-conclusão da tarefa. Item já
 * resolvido: o toque reabre (sujeito à trava "só quem concluiu ou o autor" — `locked`).
 */
export function ItemCheck({
  item,
  locked = false,
  disabled = false,
  onResolve,
}: {
  item: ChecklistItem
  locked?: boolean
  disabled?: boolean
  /** done=false reabre; done=true + failed escolhe o desfecho. */
  onResolve: (done: boolean, failed: boolean) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha o seletor ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!choosing) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setChoosing(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setChoosing(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [choosing])

  const failed = item.done && !!item.failed
  const pick = (f: boolean) => {
    setChoosing(false)
    onResolve(true, f)
  }

  return (
    <div ref={ref} className="relative mt-0.5 flex-none">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (item.done) onResolve(false, false)
          else setChoosing((v) => !v)
        }}
        disabled={disabled || locked}
        aria-label={item.done ? 'Reabrir item' : 'Concluir item'}
        aria-expanded={item.done ? undefined : choosing}
        title={
          locked
            ? `Só ${item.doneByName?.split(' ')[0] ?? 'quem concluiu'} ou o autor pode alterar`
            : item.done
              ? failed
                ? 'Não feito — toque para reabrir'
                : 'Feito — toque para reabrir'
              : undefined
        }
        className={`grid h-[18px] w-[18px] place-items-center rounded-full border transition-colors ${
          item.done ? 'text-[#0A0A0B]' : 'border-border-strong text-transparent hover:border-accent'
        } ${locked ? 'cursor-not-allowed opacity-80' : ''}`}
        style={
          item.done
            ? failed
              ? { background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }
              : { background: 'var(--success)', borderColor: 'var(--success)' }
            : undefined
        }
      >
        <Icon name={failed ? 'x' : 'check'} size={11} strokeWidth={3} />
      </button>

      {choosing && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 top-[calc(100%+6px)] z-20 flex w-max items-center gap-1 whitespace-nowrap rounded-full border border-border bg-bg-elevated-2 p-1 shadow-pop"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(false)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-bg-elevated"
          >
            <span className="grid h-5 w-5 flex-none place-items-center rounded-full text-[#0A0A0B]" style={{ background: 'var(--success)' }}>
              <Icon name="check" size={12} strokeWidth={3} />
            </span>
            Feito
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => pick(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-bg-elevated"
          >
            <span className="grid h-5 w-5 flex-none place-items-center rounded-full text-white" style={{ background: 'var(--danger)' }}>
              <Icon name="x" size={12} strokeWidth={3} />
            </span>
            Não feito
          </button>
        </div>
      )}
    </div>
  )
}

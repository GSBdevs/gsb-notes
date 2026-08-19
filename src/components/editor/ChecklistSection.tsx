import { useState } from 'react'
import type { Reminder } from '@/types'
import { useAddChecklistItem, useRemoveChecklistItem, useToggleChecklistItem } from '@/hooks/useChecklist'
import { formatRemindAt } from '@/lib/reminders'
import { initialsFromName } from '@/lib/constants'
import { Icon } from '@/components/ui/Icon'

/**
 * Checklist AO VIVO de uma tarefa existente (kind 'doc'). Marcar/desmarcar item é liberado a
 * QUALQUER um que veja a tarefa (a RPC no banco autoriza); adicionar/remover é só de quem edita.
 * A tarefa conclui sozinha quando todos os itens estão marcados. O dono ("mine") vê quem concluiu
 * cada item e quando (padrão "visto por"). Usado no TaskEditor (modo edição).
 */
export function ChecklistSection({ reminder, canEdit }: { reminder: Reminder; canEdit: boolean }) {
  const add = useAddChecklistItem()
  const remove = useRemoveChecklistItem()
  const toggle = useToggleChecklistItem()
  const [input, setInput] = useState('')

  const items = reminder.checklist
  const doneCount = items.filter((c) => c.done).length

  const submit = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    add.mutate({ noteId: reminder.id, text })
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        <Icon name="list-todo" size={15} />
        Itens{' '}
        {items.length > 0 && (
          <span className="text-text-muted">
            · {doneCount}/{items.length}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.id} className="group rounded-md border border-border bg-bg-base px-3 py-2">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => item.id && toggle.mutate({ itemId: item.id, done: !item.done })}
                aria-label={item.done ? 'Desmarcar item' : 'Concluir item'}
                className={`grid h-[18px] w-[18px] flex-none place-items-center rounded-full border transition-colors ${
                  item.done
                    ? 'border-success bg-success text-[#0A0A0B]'
                    : 'border-border-strong text-transparent hover:border-accent'
                }`}
              >
                <Icon name="check" size={11} strokeWidth={3} />
              </button>
              <span
                className={`min-w-0 flex-1 text-sm ${
                  item.done ? 'text-text-muted line-through' : 'text-text-primary'
                }`}
              >
                {item.text}
              </span>
              {canEdit && (
                <button
                  onClick={() => item.id && remove.mutate(item.id)}
                  aria-label={`Remover ${item.text}`}
                  className="grid h-6 w-6 flex-none place-items-center rounded text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>

            {/* Quem concluiu — só o dono da tarefa vê (padrão "visto por"). */}
            {reminder.mine && item.done && item.doneByName && (
              <div className="mt-1 flex items-center gap-1.5 pl-[28px] text-[11.5px] text-text-muted">
                <span
                  className="grid h-4 w-4 flex-none place-items-center rounded-full text-[8px] font-bold text-[#0A0A0B]"
                  style={{ background: item.doneByColor ?? '#94A3B8' }}
                >
                  {initialsFromName(item.doneByName)}
                </span>
                concluído por {item.doneByName.split(' ')[0]}
                {item.doneAt && <span>· {formatRemindAt(item.doneAt)}</span>}
              </div>
            )}
          </div>
        ))}

        {canEdit && (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Adicionar item… (Enter)"
              className="h-10 min-w-0 flex-1 rounded-md border border-dashed border-border bg-transparent px-3 text-sm text-text-primary outline-none focus:border-border-strong"
            />
            <button
              onClick={submit}
              disabled={!input.trim()}
              aria-label="Adicionar item"
              className="grid h-10 w-10 flex-none place-items-center rounded-md border border-border bg-bg-base text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40"
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        )}

        {items.length === 0 && !canEdit && (
          <p className="text-[13px] text-text-muted">Esta tarefa não tem itens.</p>
        )}
      </div>
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ChecklistItem, Reminder } from '@/types'
import {
  useAddChecklistItem,
  useAssignChecklistItem,
  useRemoveChecklistItem,
  useRenameChecklistItem,
  useReorderChecklist,
  useToggleChecklistItem,
} from '@/hooks/useChecklist'
import { useWorkspaceMembers } from '@/hooks/useWorkspaces'
import { useAppStore } from '@/store/useAppStore'
import { formatRemindAt } from '@/lib/reminders'
import { initialsFromName } from '@/lib/constants'
import { Icon } from '@/components/ui/Icon'

/** Alguém que pode ser responsável por um item (dono da tarefa + compartilhados + membros do quadro). */
interface Candidate {
  userId: string
  name: string
  color: string
  avatarUrl?: string | null
}

/**
 * Checklist AO VIVO de uma tarefa existente (kind 'doc'). Marcar/desmarcar item é liberado a
 * QUALQUER um que veja a tarefa (a RPC no banco autoriza); adicionar/remover é só de quem edita.
 * A tarefa conclui sozinha quando todos os itens estão marcados. O dono ("mine") vê quem concluiu
 * cada item e quando (padrão "visto por"). Usado no TaskEditor (modo edição).
 */
export function ChecklistSection({ reminder, canEdit }: { reminder: Reminder; canEdit: boolean }) {
  const add = useAddChecklistItem()
  const remove = useRemoveChecklistItem()
  const rename = useRenameChecklistItem()
  const toggle = useToggleChecklistItem()
  const assign = useAssignChecklistItem()
  const { data: wsMembers = [] } = useWorkspaceMembers(reminder.workspaceId)
  const meId = useAppStore((s) => s.userId)
  const [input, setInput] = useState('')
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  const items = reminder.checklist
  const doneCount = items.filter((c) => c.done).length

  // Quem pode ser responsável: dono + compartilhados 1:1 + membros do quadro (sem duplicar).
  const candidates: Candidate[] = (() => {
    const byId = new Map<string, Candidate>()
    byId.set(reminder.ownerId, {
      userId: reminder.ownerId,
      name: reminder.mine ? 'Você' : reminder.ownerName,
      color: reminder.ownerColor,
      avatarUrl: reminder.ownerAvatar,
    })
    for (const s of reminder.shares) {
      if (!byId.has(s.userId)) byId.set(s.userId, { userId: s.userId, name: s.name, color: s.color, avatarUrl: s.avatarUrl })
    }
    for (const m of wsMembers) {
      if (!byId.has(m.userId)) byId.set(m.userId, { userId: m.userId, name: m.name, color: m.color, avatarUrl: m.avatarUrl })
    }
    return [...byId.values()]
  })()

  const doAssign = (itemId: string, userId: string | null) => {
    assign.mutate({ itemId, userId })
    setPickerFor(null)
  }

  // Desmarcar um item concluído é só de quem marcou (done_by) ou do autor (dono da tarefa) — o banco
  // (RPC toggle_checklist_item, 0033) é a autoridade; aqui travamos a UI para não dar clique em vão.
  // Marcar segue livre a qualquer um que veja a tarefa.
  const lockedUncheck = (item: ChecklistItem) =>
    item.done && item.doneById !== meId && !reminder.mine

  const submit = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    add.mutate({ noteId: reminder.id, text })
  }

  // Arrastar-e-mover os itens (só quem edita e com mais de um item).
  const reorder = useReorderChecklist()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const sortable = canEdit && items.length > 1
  const ids = items.map((i) => i.id ?? '').filter(Boolean)
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    reorder.mutate({ noteId: reminder.id, orderedIds: arrayMove(ids, from, to) })
  }

  const rowProps = (item: ChecklistItem): RowProps => ({
    item,
    canEdit,
    meId,
    candidates,
    locked: lockedUncheck(item),
    pickerOpen: pickerFor === item.id,
    onTogglePicker: () => setPickerFor(pickerFor === item.id ? null : (item.id ?? null)),
    onAssign: (uid) => {
      if (item.id) doAssign(item.id, uid)
    },
    onToggle: () => {
      if (item.id && !lockedUncheck(item)) toggle.mutate({ itemId: item.id, done: !item.done })
    },
    onRename: (text) => {
      if (item.id && text && text !== item.text) rename.mutate({ itemId: item.id, text })
    },
    onRemove: () => {
      if (item.id) remove.mutate(item.id)
    },
  })

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
        {sortable ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {items.map((item) => (
                <SortableChecklistRow key={item.id} {...rowProps(item)} />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          items.map((item) => <ChecklistRowContent key={item.id} {...rowProps(item)} />)
        )}

        {canEdit && (
          <div className="flex items-start gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Enter adiciona; Shift+Enter quebra linha.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
              rows={Math.min(6, (input.match(/\n/g)?.length ?? 0) + 1)}
              placeholder="Adicionar item… (Shift+Enter quebra linha)"
              className="min-h-10 min-w-0 flex-1 resize-none rounded-md border border-dashed border-border bg-transparent px-3 py-2 text-sm leading-snug text-text-primary outline-none focus:border-border-strong"
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

interface RowProps {
  item: ChecklistItem
  canEdit: boolean
  meId: string | null
  candidates: Candidate[]
  locked: boolean
  pickerOpen: boolean
  onTogglePicker: () => void
  onAssign: (userId: string | null) => void
  onToggle: () => void
  onRename: (text: string) => void
  onRemove: () => void
}

/** Uma linha da checklist (checkbox + texto editável + responsável + remover + "concluído por"). */
function ChecklistRowContent({
  item,
  canEdit,
  meId,
  candidates,
  locked,
  pickerOpen,
  onTogglePicker,
  onAssign,
  onToggle,
  onRename,
  onRemove,
  handle,
}: RowProps & { handle?: ReactNode }) {
  return (
    <div className="group rounded-md border border-border bg-bg-base px-3 py-2">
      <div className="flex items-start gap-2.5">
        {handle}
        <button
          onClick={onToggle}
          disabled={locked}
          aria-label={item.done ? 'Desmarcar item' : 'Concluir item'}
          title={locked ? `Só ${item.doneByName?.split(' ')[0] ?? 'quem concluiu'} ou o autor pode desmarcar` : undefined}
          className={`mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full border transition-colors ${
            item.done
              ? 'border-success bg-success text-[#0A0A0B]'
              : 'border-border-strong text-transparent hover:border-accent'
          } ${locked ? 'cursor-not-allowed opacity-80' : ''}`}
        >
          <Icon name="check" size={11} strokeWidth={3} />
        </button>
        {canEdit ? (
          <textarea
            defaultValue={item.text}
            onBlur={(e) => onRename(e.target.value.trim())}
            onKeyDown={(e) => {
              // Enter confirma; Shift+Enter quebra linha.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ;(e.target as HTMLTextAreaElement).blur()
              }
            }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${el.scrollHeight}px`
            }}
            rows={Math.min(6, (item.text.match(/\n/g)?.length ?? 0) + 1)}
            aria-label="Editar item"
            className={`min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-sm leading-snug outline-none ${
              item.done ? 'text-text-muted line-through' : 'text-text-primary'
            }`}
          />
        ) : (
          <span
            className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-sm ${
              item.done ? 'text-text-muted line-through' : 'text-text-primary'
            }`}
          >
            {item.text}
          </span>
        )}
        <AssigneeControl
          item={item}
          candidates={candidates}
          canEdit={canEdit}
          meId={meId}
          open={pickerOpen}
          onToggleOpen={onTogglePicker}
          onAssign={onAssign}
        />
        {canEdit && (
          <button
            onClick={onRemove}
            aria-label={`Remover ${item.text}`}
            className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
          >
            <Icon name="x" size={13} />
          </button>
        )}
      </div>

      {/* Quem concluiu — visível a TODOS os participantes da tarefa (padrão "visto por"). */}
      {item.done && item.doneByName && (
        <div className="mt-1 flex items-center gap-1.5 pl-[28px] text-[11.5px] text-text-muted">
          <span
            className="grid h-4 w-4 flex-none place-items-center rounded-full text-[8px] font-bold text-[#0A0A0B]"
            style={{ background: item.doneByColor ?? '#94A3B8' }}
          >
            {initialsFromName(item.doneByName)}
          </span>
          concluído por {item.doneById && item.doneById === meId ? 'você' : item.doneByName.split(' ')[0]}
          {item.doneAt && <span>· {formatRemindAt(item.doneAt)}</span>}
        </div>
      )}
    </div>
  )
}

/** A mesma linha, arrastável (dnd-kit) por um "grip" à esquerda. Usada só no modo edição. */
function SortableChecklistRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id ?? '',
  })
  const handle = (
    <button
      type="button"
      aria-label="Arrastar para reordenar"
      className="mt-0.5 flex-none cursor-grab touch-none text-text-muted transition-colors hover:text-text-secondary active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <Icon name="grip-vertical" size={15} />
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
        opacity: isDragging ? 0.9 : 1,
      }}
    >
      <ChecklistRowContent {...props} handle={handle} />
    </div>
  )
}

/** Mini-avatar (foto ou iniciais sobre a cor). */
function MiniAvatar({ name, color, avatarUrl, size = 20 }: { name: string; color: string; avatarUrl?: string | null; size?: number }) {
  return (
    <span
      className="grid flex-none place-items-center overflow-hidden rounded-full font-bold text-[#0A0A0B]"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
    >
      {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initialsFromName(name)}
    </span>
  )
}

/**
 * Responsável de um item ("quem deve"). Todos veem o avatar; só quem edita atribui/troca/limpa.
 * Abre um picker com os candidatos (dono + compartilhados + membros do quadro).
 */
function AssigneeControl({
  item,
  candidates,
  canEdit,
  meId,
  open,
  onToggleOpen,
  onAssign,
}: {
  item: ChecklistItem
  candidates: Candidate[]
  canEdit: boolean
  meId: string | null
  open: boolean
  onToggleOpen: () => void
  onAssign: (userId: string | null) => void
}) {
  const assigned = item.assigneeId
  // Sem responsável e sem poder editar → nada a mostrar.
  if (!assigned && !canEdit) return null

  // Direcionado a mim: o próprio responsável (e todos) veem o direcionamento; para mim, "Você".
  const isMe = !!assigned && item.assigneeId === meId
  const label = isMe ? 'Você' : (item.assigneeName ?? 'Responsável').split(' ')[0]

  const trigger = assigned ? (
    <button
      type="button"
      onClick={canEdit ? onToggleOpen : undefined}
      title={isMe ? 'Direcionado a você' : item.assigneeName ? `Responsável: ${item.assigneeName}` : 'Responsável'}
      className={`inline-flex flex-none items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-[11.5px] font-semibold ${isMe ? 'border-accent bg-accent-surface text-accent-ink' : 'border-border bg-bg-elevated-2 text-text-secondary'} ${canEdit ? 'transition-colors hover:border-border-strong' : 'cursor-default'}`}
    >
      <MiniAvatar name={item.assigneeName ?? '?'} color={item.assigneeColor ?? '#94A3B8'} avatarUrl={item.assigneeAvatar} size={18} />
      {label}
    </button>
  ) : (
    <button
      type="button"
      onClick={onToggleOpen}
      title="Atribuir responsável"
      aria-label="Atribuir responsável"
      className="grid h-6 w-6 flex-none place-items-center rounded-full border border-dashed border-border text-text-muted opacity-0 transition-all hover:border-border-strong hover:text-text-primary group-hover:opacity-100"
    >
      <Icon name="user-plus" size={13} />
    </button>
  )

  return (
    <div className="relative flex-none">
      {trigger}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={onToggleOpen} />
          <div className="absolute right-0 top-full z-20 mt-1 max-h-64 w-52 overflow-y-auto rounded-md border border-border bg-bg-elevated-2 p-1 shadow-pop">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[.04em] text-text-muted">
              Responsável
            </div>
            {candidates.map((c) => (
              <button
                key={c.userId}
                type="button"
                onClick={() => onAssign(c.userId)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-elevated"
              >
                <MiniAvatar name={c.name} color={c.color} avatarUrl={c.avatarUrl} size={20} />
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {assigned === c.userId && <Icon name="check" size={14} style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
            {assigned && (
              <button
                type="button"
                onClick={() => onAssign(null)}
                className="mt-0.5 flex w-full items-center gap-2 rounded border-t border-border px-2 py-1.5 text-left text-[13px] text-text-muted transition-colors hover:bg-bg-elevated hover:text-danger"
              >
                <Icon name="x" size={14} />
                Sem responsável
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

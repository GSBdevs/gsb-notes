import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useCreateReminder, useDeleteReminder, useReminders, useSetStatus, useUpdateReminder } from '@/hooks/useReminders'
import { useWorkspaceMembers, useWorkspaces } from '@/hooks/useWorkspaces'
import { canEditReminder } from '@/lib/reminders'
import { CARD_COLORS } from '@/lib/constants'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { SharePicker } from '@/components/editor/SharePicker'
import { ChecklistSection } from '@/components/editor/ChecklistSection'
import { CommentsSection } from '@/components/editor/CommentsSection'
import { AttachmentsSection } from '@/components/editor/AttachmentsSection'

/**
 * Editor de tarefas & anotações (kind 'doc'): título + checklist + texto livre, com o MESMO
 * compartilhamento dos lembretes (pessoas 1:1 e quadros). Quem só pode ver abre em leitura,
 * mas participa da conversa.
 */
export function TaskEditor() {
  const open = useAppStore((s) => s.taskOpen)
  const draft = useAppStore((s) => s.taskDraft)
  const patch = useAppStore((s) => s.patchTask)
  const close = useAppStore((s) => s.closeTask)
  const showToast = useAppStore((s) => s.showToast)

  const create = useCreateReminder()
  const update = useUpdateReminder()
  const setStatus = useSetStatus()
  const del = useDeleteReminder()
  const { data: reminders = [] } = useReminders()
  const { data: workspaces = [] } = useWorkspaces()
  // Membros do quadro já veem a tarefa — fora do compartilhamento 1:1.
  const { data: wsMembers = [] } = useWorkspaceMembers(draft.workspaceId)

  const [error, setError] = useState<string | null>(null)
  const [itemInput, setItemInput] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  if (!open) return null

  const isEdit = draft.mode === 'edit'
  const saving = create.isPending || update.isPending
  const current = isEdit ? reminders.find((r) => r.id === draft.id) : null
  // Novo = editável; existente = dono/permissão. Viewers abrem em leitura (e usam a conversa).
  const canEdit = !isEdit || !current || canEditReminder(current, workspaces)

  const save = async () => {
    setError(null)
    try {
      if (isEdit && draft.id) {
        await update.mutateAsync({ id: draft.id, draft })
        showToast('Tarefa atualizada')
      } else {
        await create.mutateAsync(draft)
        showToast('Tarefa criada')
      }
      close()
    } catch (e) {
      const msg = (e as { message?: string })?.message
      setError(msg ? `Erro ao salvar: ${msg}` : 'Não foi possível salvar. Verifique a conexão.')
    }
  }

  const addItem = () => {
    const text = itemInput.trim()
    if (!text) return
    patch({ checklist: [...draft.checklist, { text, done: false }] })
    setItemInput('')
  }
  const toggleItem = (i: number) =>
    patch({
      checklist: draft.checklist.map((c, idx) => (idx === i ? { ...c, done: !c.done } : c)),
    })
  const removeItem = (i: number) =>
    patch({ checklist: draft.checklist.filter((_, idx) => idx !== i) })

  const doneCount = draft.checklist.filter((c) => c.done).length

  // Tarefas COM itens concluem sozinhas (todos marcados). As SEM itens precisam de conclusão manual.
  const itemless = isEdit && !!current && current.checklist.length === 0
  const isDone = current?.status === 'archived'
  const toggleDone = () => {
    if (!current) return
    const next = isDone ? 'active' : 'archived'
    setStatus.mutate({ id: current.id, status: next })
    showToast(next === 'archived' ? 'Tarefa concluída' : 'Tarefa reaberta')
  }
  // Excluir a tarefa (só o dono), em dois toques.
  const canDelete = isEdit && !!current && current.mine
  const doDelete = () => {
    if (!current) return
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 3500)
      return
    }
    del.mutate(current.id)
    showToast('Tarefa excluída')
    close()
  }

  return (
    <Modal
      title={isEdit ? (canEdit ? 'Editar tarefa' : 'Tarefa') : 'Nova tarefa'}
      onClose={close}
      maxWidth={620}
      footer={
        canEdit ? (
          <>
            {error && (
              <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-danger">
                <Icon name="alert-triangle" size={15} />
                <span className="truncate">{error}</span>
              </div>
            )}
            {canDelete && (
              <button
                onClick={doDelete}
                disabled={saving}
                className={`inline-flex h-[42px] items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  confirmDel
                    ? 'border-danger bg-[#ef44441a] text-danger'
                    : 'border-border bg-transparent text-text-secondary hover:border-danger hover:text-danger'
                }`}
              >
                <Icon name={confirmDel ? 'check' : 'trash-2'} size={15} />
                {confirmDel ? 'Confirmar?' : 'Excluir'}
              </button>
            )}
            <div className="flex-1" />
            {itemless && (
              <button
                onClick={toggleDone}
                disabled={saving}
                className="inline-flex h-[42px] items-center gap-2 rounded-md border border-border bg-bg-elevated px-4 text-sm font-semibold text-text-primary transition-colors hover:border-border-strong disabled:opacity-60"
              >
                <Icon name={isDone ? 'rotate-ccw' : 'check'} size={15} />
                {isDone ? 'Reabrir' : 'Concluir'}
              </button>
            )}
            <button
              onClick={close}
              disabled={saving}
              className="h-[42px] rounded-md border border-border bg-transparent px-[18px] text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
            >
              {saving && <Icon name="loader-2" size={16} className="animate-spin" />}
              {saving ? 'Salvando…' : 'Salvar tarefa'}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-[18px] p-5">
        <input
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Título da tarefa"
          disabled={!canEdit}
          className="w-full bg-transparent text-xl font-semibold tracking-[-.01em] text-text-primary outline-none disabled:opacity-80"
        />

        {/* Checklist — em tarefa existente é AO VIVO (todos marcam; dono vê quem concluiu);
            numa tarefa nova, monta-se no rascunho e é semeada ao salvar. */}
        {isEdit ? (
          current && <ChecklistSection reminder={current} canEdit={canEdit} />
        ) : (
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
              <Icon name="list-todo" size={15} />
              Itens{' '}
              {draft.checklist.length > 0 && (
                <span className="text-text-muted">
                  · {doneCount}/{draft.checklist.length}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {draft.checklist.map((item, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-2.5 rounded-md border border-border bg-bg-base px-3 py-2"
                >
                  <button
                    onClick={() => toggleItem(i)}
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
                  <button
                    onClick={() => removeItem(i)}
                    aria-label={`Remover ${item.text}`}
                    className="grid h-6 w-6 flex-none place-items-center rounded text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={itemInput}
                  onChange={(e) => setItemInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addItem()
                    }
                  }}
                  placeholder="Adicionar item… (Enter)"
                  className="h-10 min-w-0 flex-1 rounded-md border border-dashed border-border bg-transparent px-3 text-sm text-text-primary outline-none focus:border-border-strong"
                />
                <button
                  onClick={addItem}
                  disabled={!itemInput.trim()}
                  aria-label="Adicionar item"
                  className="grid h-10 w-10 flex-none place-items-center rounded-md border border-border bg-bg-base text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-40"
                >
                  <Icon name="plus" size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Anotações */}
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
            <Icon name="pencil" size={14} />
            Anotações
          </div>
          <textarea
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="Escreva livremente — contexto, links, ideias…"
            disabled={!canEdit}
            className="min-h-[110px] w-full resize-y rounded-md border border-border bg-bg-base px-3.5 py-3 text-sm leading-relaxed text-text-primary outline-none focus:border-border-strong disabled:opacity-80"
          />
        </div>

        {/* Cor */}
        {canEdit && (
          <div>
            <div className="mb-2.5 text-[13px] font-medium text-text-secondary">Cor</div>
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map((c) => {
                const on = draft.color === c.hex
                return (
                  <button
                    key={c.hex}
                    title={c.name}
                    onClick={() => patch({ color: c.hex })}
                    className="h-[26px] w-[26px] rounded-full transition-transform hover:scale-105"
                    style={{
                      background: c.hex,
                      border: `2px solid ${on ? 'var(--text-primary)' : 'transparent'}`,
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Quadro — só o dono move */}
        {workspaces.length > 0 && draft.ownedByMe && (
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
              <Icon name="layout-grid" size={14} />
              Quadro
            </div>
            <div className="flex flex-wrap gap-2">
              <TaskWorkspaceChip
                label="Pessoal"
                on={draft.workspaceId === null}
                onClick={() => patch({ workspaceId: null })}
              />
              {workspaces.map((w) => (
                <TaskWorkspaceChip
                  key={w.id}
                  label={w.name}
                  color={w.color}
                  on={draft.workspaceId === w.id}
                  onClick={() => patch({ workspaceId: w.id })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Compartilhar — só o dono gerencia; para quem só vê, some da tela. */}
        {draft.ownedByMe && (
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
              <Icon name="share-2" size={14} />
              Compartilhar com
            </div>
            <SharePicker
              shares={draft.shares}
              onChange={(shares) => patch({ shares })}
              canManage={canEdit}
              excludeUserIds={wsMembers.map((m) => m.userId)}
              excludeReason="já faz parte do quadro"
            />
          </div>
        )}

        {/* Anexos + conversa — só em tarefa existente */}
        {isEdit && draft.id && <AttachmentsSection noteId={draft.id} />}
        {isEdit && draft.id && <CommentsSection noteId={draft.id} />}
      </div>
    </Modal>
  )
}

function TaskWorkspaceChip({
  label,
  color,
  on,
  onClick,
}: {
  label: string
  color?: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] transition-colors ${
        on
          ? 'border-accent bg-accent-surface font-semibold text-accent-ink'
          : 'border-border bg-bg-base font-medium text-text-secondary hover:border-border-strong'
      }`}
    >
      <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: color ?? 'var(--text-muted)' }} />
      {label}
    </button>
  )
}

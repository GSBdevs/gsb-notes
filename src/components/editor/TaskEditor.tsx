import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useCreateReminder, useDeleteReminder, useReminders, useSetStatus, useUpdateReminder } from '@/hooks/useReminders'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useFolderShareDefaults } from '@/hooks/useFolderShareDefaults'
import { canEditReminder } from '@/lib/reminders'
import { CARD_COLORS } from '@/lib/constants'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { SharePicker } from '@/components/editor/SharePicker'
import { ChecklistSection } from '@/components/editor/ChecklistSection'
import { ItemCheck } from '@/components/editor/ItemCheck'
import { CommentsSection } from '@/components/editor/CommentsSection'
import { AttachmentsSection } from '@/components/editor/AttachmentsSection'
import { AutoTextarea } from '@/components/ui/AutoTextarea'
import {
  useBoards,
  useCreateRoute,
  useDeleteRoute,
  useLogisticsAccess,
  useRoutes,
  useSetRouteTechnician,
  useTechnicians,
} from '@/hooks/useLogistics'
import { CITY_LABEL, SLOT_LABEL } from '@/lib/logistics'

/**
 * Editor de tarefas & anotações (kind 'doc'): título + checklist + texto livre, com o MESMO
 * compartilhamento dos lembretes (pessoas 1:1 e quadros). Quem só pode ver abre em leitura,
 * mas participa da conversa.
 *
 * MODO ROTA (kind 'route', aba Logística — doc 21): o mesmo modal como "Nova Rota", sem cor, pasta,
 * compartilhar e conversa; com cidade/vaga e técnico. Quem edita: Master/Admin/Suporte ou o técnico
 * da rota. Itens só são marcados na Rota do dia (a Pré-Rota é o planejamento do dia seguinte).
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
  const { personal, setPersonal, hasFolder } = useFolderShareDefaults({
    open,
    mode: draft.mode,
    workspaceId: draft.workspaceId,
    shares: draft.shares,
    setShares: (shares) => patch({ shares }),
  })

  // Logística (modo rota).
  const isRoute = draft.kind === 'route'
  const access = useLogisticsAccess()
  const { data: routeMetas = [] } = useRoutes(open && isRoute)
  const { data: technicians = [] } = useTechnicians(open && isRoute)
  const { data: boards = [] } = useBoards(open && isRoute)
  const createRoute = useCreateRoute()
  const setTechnician = useSetRouteTechnician()
  const delRoute = useDeleteRoute()

  const [error, setError] = useState<string | null>(null)
  const [itemInput, setItemInput] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)

  // Limpa o campo de item ao (re)abrir — senão o texto digitado numa tarefa anterior reaparece na
  // próxima (carry-over). O editor fica sempre montado, então o estado local persistiria sem isto.
  useEffect(() => {
    if (open) setItemInput('')
  }, [open])

  if (!open) return null

  const isEdit = draft.mode === 'edit'
  const saving = create.isPending || update.isPending || createRoute.isPending
  const current = isEdit ? reminders.find((r) => r.id === draft.id) : null
  // Rota: dados vivos de logistics_routes (a vaga muda na virada do dia); senão, o que veio no rascunho.
  const routeMeta = isRoute ? (routeMetas.find((m) => m.noteId === draft.id) ?? null) : null
  const routeSlot = routeMeta?.slot ?? draft.route?.slot ?? 'rota'
  // Cidade fixa OU card extra (0040).
  const routeCity = routeMeta ? routeMeta.city : (draft.route?.city ?? null)
  const routeBoardId = routeMeta ? routeMeta.boardId : (draft.route?.boardId ?? null)
  const placeLabel = routeCity
    ? CITY_LABEL[routeCity]
    : (boards.find((b) => b.id === routeBoardId)?.name ?? 'Card')
  // Novo = editável; existente = dono/permissão. Viewers abrem em leitura (e usam a conversa).
  // Rota: gerente sempre; técnico só a dele; os demais só veem.
  const canEdit = isRoute
    ? isEdit
      ? routeSlot !== 'concluida' && access.canEditRoute(routeMeta)
      : access.isManager
    : !isEdit || !current || canEditReminder(current, workspaces)
  const noun = isRoute ? 'Rota' : 'Tarefa'

  const save = async () => {
    setError(null)
    try {
      if (isRoute && !isEdit) {
        const pending = itemInput.trim()
        await createRoute.mutateAsync({
          city: routeCity,
          boardId: routeBoardId,
          slot: routeSlot === 'pre_rota' ? 'pre_rota' : 'rota',
          title: draft.title,
          body: draft.body,
          items: [...draft.checklist.map((c) => c.text), ...(pending ? [pending] : [])],
          technicianId: draft.route?.technicianId ?? null,
        })
        showToast('Rota criada')
      } else if (isEdit && draft.id) {
        await update.mutateAsync({ id: draft.id, draft })
        // Técnico mudou (só gerente troca) → RPC própria (logistics_routes não é editável direto).
        const nextTech = draft.route?.technicianId ?? null
        if (isRoute && access.isManager && routeMeta && nextTech !== routeMeta.technicianId) {
          await setTechnician.mutateAsync({ noteId: draft.id, technicianId: nextTech })
        }
        showToast(`${noun} atualizada`)
      } else {
        // Inclui o item que ficou digitado sem Enter/＋ — criar sem precisar do Enter.
        const pending = itemInput.trim()
        const toCreate = pending
          ? { ...draft, checklist: [...draft.checklist, { text: pending, done: false }] }
          : draft
        await create.mutateAsync(toCreate)
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
  const resolveItem = (i: number, done: boolean, failed: boolean) =>
    patch({
      checklist: draft.checklist.map((c, idx) => (idx === i ? { ...c, done, failed: done && failed } : c)),
    })
  const removeItem = (i: number) =>
    patch({ checklist: draft.checklist.filter((_, idx) => idx !== i) })
  const editItem = (i: number, text: string) =>
    patch({ checklist: draft.checklist.map((c, idx) => (idx === i ? { ...c, text } : c)) })

  const doneCount = draft.checklist.filter((c) => c.done).length

  // Tarefas COM itens concluem sozinhas (todos marcados). As SEM itens precisam de conclusão manual.
  // Rota: só a Rota do dia conclui, e rota concluída não reabre (desfaria a virada do dia).
  const isDone = current?.status === 'archived'
  const itemless =
    isEdit &&
    !!current &&
    current.checklist.length === 0 &&
    (!isRoute || (routeSlot === 'rota' && !isDone))
  const toggleDone = () => {
    if (!current) return
    const next = isDone ? 'active' : 'archived'
    setStatus.mutate({ id: current.id, status: next })
    showToast(next === 'archived' ? `${noun} concluída` : `${noun} reaberta`)
  }
  // Excluir a tarefa (só o dono), em dois toques. Rota: só gerente (RPC).
  const canDelete = isEdit && !!current && (isRoute ? access.isManager : current.mine)
  const doDelete = () => {
    if (!current) return
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 3500)
      return
    }
    if (isRoute) delRoute.mutate(current.id)
    else del.mutate(current.id)
    showToast(`${noun} excluída`)
    close()
  }

  return (
    <Modal
      title={isEdit ? (canEdit ? `Editar ${noun.toLowerCase()}` : noun) : `Nova ${noun}`}
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
              {saving ? 'Salvando…' : `Salvar ${noun.toLowerCase()}`}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-[18px] p-5">
        <AutoTextarea
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          onKeyDown={(e) => {
            // Enter não vira nova linha num título (o texto só quebra visualmente ao encher a box).
            if (e.key === 'Enter') e.preventDefault()
          }}
          placeholder={isRoute ? 'Título da rota (ex.: Rota 30/10 — Serra)' : 'Título da tarefa'}
          disabled={!canEdit}
          className="w-full resize-none overflow-hidden break-words bg-transparent text-xl font-semibold tracking-[-.01em] text-text-primary outline-none disabled:opacity-80"
        />

        {/* Rota (Logística): cidade/vaga fixas pela vaga; técnico — só gerente troca. */}
        {isRoute && (
          <div className="flex flex-wrap items-center gap-2.5 rounded-md border border-border bg-bg-base px-3.5 py-3">
            <Icon name="route" size={16} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm font-semibold">{placeLabel}</span>
            <span className="rounded-full bg-bg-elevated-2 px-2 py-0.5 text-[11.5px] font-semibold text-text-secondary">
              {routeBoardId && routeSlot === 'rota' ? 'Rota' : SLOT_LABEL[routeSlot]}
            </span>
            <div className="flex-1" />
            {access.isManager && routeSlot !== 'concluida' ? (
              <select
                value={draft.route?.technicianId ?? ''}
                onChange={(e) =>
                  patch({
                    route: {
                      city: routeCity,
                      boardId: routeBoardId,
                      slot: routeSlot,
                      technicianId: e.target.value || null,
                    },
                  })
                }
                aria-label="Técnico da rota"
                className="h-9 max-w-full rounded-md border border-border bg-bg-elevated px-2.5 text-[13px] font-medium text-text-primary outline-none focus:border-border-strong"
              >
                <option value="">Sem técnico</option>
                {technicians.map((t) => (
                  <option key={t.userId} value={t.userId}>
                    {t.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[13px] text-text-secondary">
                Técnico: <b className="font-semibold text-text-primary">{routeMeta?.technicianName ?? 'sem técnico'}</b>
              </span>
            )}
          </div>
        )}
        {isRoute && access.isManager && technicians.length === 0 && routeSlot !== 'concluida' && (
          <p className="-mt-2 text-[12px] text-text-muted">
            Nenhum técnico definido ainda — defina em “Técnicos”, na aba Logística.
          </p>
        )}

        {/* Checklist — em tarefa existente é AO VIVO (todos marcam; dono vê quem concluiu);
            numa tarefa nova, monta-se no rascunho e é semeada ao salvar. */}
        {isEdit ? (
          current && (
            <ChecklistSection
              reminder={current}
              canEdit={canEdit}
              canMark={!isRoute || (canEdit && routeSlot === 'rota')}
              canOverrideLock={isRoute && access.isManager}
            />
          )
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
                  className="group flex items-start gap-2.5 rounded-md border border-border bg-bg-base px-3 py-2"
                >
                  <ItemCheck
                    item={item}
                    disabled={isRoute}
                    onResolve={(done, failed) => resolveItem(i, done, failed)}
                  />
                  <AutoTextarea
                    value={item.text}
                    onChange={(e) => editItem(i, e.target.value)}
                    onKeyDown={(e) => {
                      // Enter confirma (tira o foco); Shift+Enter quebra linha.
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        ;(e.target as HTMLTextAreaElement).blur()
                      }
                    }}
                    aria-label="Editar item"
                    className={`min-w-0 flex-1 resize-none bg-transparent text-sm leading-snug outline-none ${
                      item.done ? 'text-text-muted line-through' : 'text-text-primary'
                    }`}
                  />
                  <button
                    onClick={() => removeItem(i)}
                    aria-label={`Remover ${item.text}`}
                    className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
              <div className="flex items-start gap-2">
                <AutoTextarea
                  value={itemInput}
                  onChange={(e) => setItemInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter adiciona; Shift+Enter quebra linha.
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      addItem()
                    }
                  }}
                  placeholder="Adicionar item… (Shift+Enter quebra linha)"
                  className="min-h-10 min-w-0 flex-1 resize-none rounded-md border border-dashed border-border bg-transparent px-3 py-2 text-sm leading-snug text-text-primary outline-none focus:border-border-strong"
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
          <AutoTextarea
            value={draft.body}
            onChange={(e) => patch({ body: e.target.value })}
            placeholder="Escreva livremente — contexto, links, ideias…"
            disabled={!canEdit}
            className="min-h-[110px] w-full resize-none rounded-md border border-border bg-bg-base px-3.5 py-3 text-sm leading-relaxed text-text-primary outline-none focus:border-border-strong disabled:opacity-80"
          />
        </div>

        {/* Cor (rota: não tem) */}
        {canEdit && !isRoute && (
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

        {/* Pasta — só o dono move */}
        {workspaces.length > 0 && draft.ownedByMe && !isRoute && (
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
              <Icon name="layout-grid" size={14} />
              Pasta
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
            <p className="mt-1.5 text-[12px] text-text-muted">
              Numa pasta, a tarefa já vem marcada para as pessoas dela — ajuste quem recebe abaixo.
            </p>
          </div>
        )}

        {/* Compartilhar — numa pasta vem pré-marcado com as pessoas dela (editável por item) + "Pessoal". */}
        {draft.ownedByMe && !isRoute && (
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
              <Icon name="share-2" size={14} />
              Compartilhar com
            </div>
            {hasFolder && (
              <label className="mb-3 flex cursor-pointer select-none items-center gap-2.5 text-[13.5px] text-text-secondary">
                <input
                  type="checkbox"
                  checked={personal}
                  onChange={(e) => setPersonal(e.target.checked)}
                  className="h-4 w-4 flex-none"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span>
                  <b className="font-semibold text-text-primary">Pessoal</b> — só para mim (ninguém da pasta recebe)
                </span>
              </label>
            )}
            {personal ? (
              <p className="text-[12.5px] text-text-muted">Esta tarefa fica só para você.</p>
            ) : (
              <SharePicker
                shares={draft.shares}
                onChange={(shares) => patch({ shares })}
                canManage={canEdit}
              />
            )}
          </div>
        )}

        {/* Anexos + conversa — só em tarefa existente */}
        {/* Rota: anexos só para quem edita, sem conversa. */}
        {isEdit && draft.id && (!isRoute || canEdit) && <AttachmentsSection noteId={draft.id} />}
        {isEdit && draft.id && !isRoute && <CommentsSection noteId={draft.id} />}
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

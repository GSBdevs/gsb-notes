import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Person, Priority, Recurrence } from '@/types'
import { CARD_COLORS, PRIORITIES, RECURRENCES, tint } from '@/lib/constants'
import { formatRemindAt } from '@/lib/reminders'
import { useAppStore } from '@/store/useAppStore'
import { useCreateReminder, useUpdateReminder } from '@/hooks/useReminders'
import { usePeople } from '@/hooks/usePeople'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { notesService } from '@/services/notesService'
import { ReminderCardView } from '@/components/ReminderCard'
import { CommentsSection } from '@/components/editor/CommentsSection'
import { DateTimeField } from '@/components/ui/DateTimeField'
import { Toggle } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'

export function ReminderEditor() {
  const open = useAppStore((s) => s.editorOpen)
  const draft = useAppStore((s) => s.draft)
  const patch = useAppStore((s) => s.patchDraft)
  const close = useAppStore((s) => s.closeEditor)
  const setTab = useAppStore((s) => s.setTab)
  const openTrigger = useAppStore((s) => s.openTrigger)
  const showToast = useAppStore((s) => s.showToast)

  const create = useCreateReminder()
  const update = useUpdateReminder()
  const { data: people = [] } = usePeople()
  const { data: workspaces = [] } = useWorkspaces()

  const [error, setError] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [shareEmail, setShareEmail] = useState('')
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  // Fecha só se o clique começou E terminou no backdrop (não em arrasto de seleção).
  const pressedOnBackdrop = useRef(false)

  if (!open) return null

  const isEdit = draft.mode === 'edit'
  const saving = create.isPending || update.isPending

  const save = async () => {
    setError(null)
    try {
      if (isEdit && draft.id) {
        await update.mutateAsync({ id: draft.id, draft })
        showToast('Lembrete atualizado')
      } else {
        await create.mutateAsync(draft)
        showToast('Lembrete criado')
      }
      setTab('active')
      close()
    } catch {
      // Mantém o modal aberto e sinaliza o erro — o rascunho não se perde.
      setError('Não foi possível salvar. Verifique a conexão e tente de novo.')
    }
  }

  const testFire = () => {
    close()
    openTrigger(draft.id) // null => o overlay usa um lembrete de exemplo
  }

  const addShare = async () => {
    const email = shareEmail.trim()
    setShareError(null)
    if (!email) return
    setShareBusy(true)
    try {
      const person = await notesService.findPersonByEmail(email)
      if (!person) {
        setShareError('Nenhum usuário com esse e-mail.')
      } else if (draft.shares.some((s) => s.userId === person.userId)) {
        setShareError('Essa pessoa já está na lista.')
      } else {
        patch({ shares: [...draft.shares, person] })
        setShareEmail('')
      }
    } catch {
      setShareError('Não foi possível buscar. Tente de novo.')
    } finally {
      setShareBusy(false)
    }
  }

  const toggleSharePerm = (userId: string) =>
    patch({
      shares: draft.shares.map((s) =>
        s.userId === userId ? { ...s, perm: s.perm === 'edit' ? 'view' : 'edit' } : s,
      ),
    })

  const removeShare = (userId: string) =>
    patch({ shares: draft.shares.filter((s) => s.userId !== userId) })

  // Adiciona alguém já conhecido (com quem você já compartilha) sem redigitar o e-mail.
  const addKnownPerson = (p: Person) => {
    if (draft.shares.some((s) => s.userId === p.userId)) return
    setShareError(null)
    patch({
      shares: [
        ...draft.shares,
        { userId: p.userId, name: p.name, initials: p.initials, color: p.color, perm: 'view' },
      ],
    })
  }

  // Pessoas conhecidas ainda não adicionadas a este lembrete (sugestões de 1 clique).
  const suggestions = people.filter((p) => !draft.shares.some((s) => s.userId === p.userId))

  const addTag = () => {
    const t = tagInput.trim().replace(/^#+/, '').toLowerCase()
    if (t && !draft.tags.includes(t)) patch({ tags: [...draft.tags, t] })
    setTagInput('')
  }
  const removeTag = (t: string) => patch({ tags: draft.tags.filter((x) => x !== t) })

  return (
    <div
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressedOnBackdrop.current) close()
      }}
      className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-8"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-screen w-full max-w-[860px] flex-col overflow-hidden border border-border bg-bg-surface shadow-pop md:max-h-[92vh] md:rounded-[18px]"
      >
        {/* Header */}
        <div className="flex items-center border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{isEdit ? 'Editar lembrete' : 'Novo lembrete'}</h2>
          <div className="flex-1" />
          <button onClick={close} className="grid place-items-center text-text-muted hover:text-text-primary">
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Body: form + preview */}
        <div className="flex flex-1 flex-wrap overflow-y-auto">
          {/* Form */}
          <div className="flex min-w-[280px] flex-1 flex-col gap-[18px] p-5">
            <input
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Título do lembrete"
              className="w-full bg-transparent text-xl font-semibold tracking-[-.01em] text-text-primary outline-none"
            />
            <textarea
              value={draft.body}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder="Escreva os detalhes…"
              className="min-h-[110px] w-full resize-y rounded-md border border-border bg-bg-base px-3.5 py-3 text-sm leading-relaxed text-text-primary outline-none focus:border-border-strong"
            />

            {/* Cor */}
            <Field label="Cor">
              <div className="flex flex-wrap gap-2.5">
                {CARD_COLORS.map((c) => {
                  const on = draft.color === c.hex
                  return (
                    <button
                      key={c.hex}
                      title={c.name}
                      onClick={() => patch({ color: c.hex })}
                      className="h-[34px] w-[34px] rounded-full transition-transform hover:scale-105"
                      style={{
                        background: c.hex,
                        border: `2px solid ${on ? 'var(--text-primary)' : 'transparent'}`,
                        boxShadow: on ? `0 0 0 2px ${c.hex}` : 'none',
                      }}
                    />
                  )
                })}
              </div>
            </Field>

            {/* Prioridade */}
            <Field label="Prioridade">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PRIORITIES) as Priority[]).map((k) => {
                  const p = PRIORITIES[k]
                  const on = draft.priority === k
                  return (
                    <button
                      key={k}
                      onClick={() => patch({ priority: k })}
                      className="inline-flex h-[38px] items-center gap-1.5 rounded-md px-3.5 text-[13.5px]"
                      style={{
                        fontWeight: on ? 600 : 500,
                        background: on ? tint(p.color) : 'var(--bg-base)',
                        color: on ? p.color : 'var(--text-secondary)',
                        border: `1px solid ${on ? p.color : 'var(--border)'}`,
                      }}
                    >
                      <Icon name={p.icon} size={14} />
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            {/* Fixar */}
            <div className="flex items-center gap-3 rounded-md border border-border bg-bg-base px-3.5 py-3">
              <Icon name="pin" size={16} style={{ color: 'var(--text-secondary)' }} />
              <div className="flex-1">
                <div className="text-sm font-medium">Fixar no topo</div>
                <div className="text-[12.5px] text-text-muted">Mantém o lembrete sempre visível no mural</div>
              </div>
              <Toggle checked={draft.pinned} onChange={() => patch({ pinned: !draft.pinned })} />
            </div>

            {/* Lembrar em */}
            <Field label="Lembrar em" icon="alarm-clock">
              <DateTimeField value={draft.remindAt} onChange={(iso) => patch({ remindAt: iso })} />
              <p className="mt-1.5 text-[12px] text-text-muted">
                Limpe o horário para um lembrete sem alarme. Com data futura, ele vai para "Agendados".
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {RECURRENCES.map((r) => {
                  const on = draft.recurrence === r.key
                  return (
                    <button
                      key={r.key}
                      onClick={() => patch({ recurrence: r.key as Recurrence })}
                      className="h-8 rounded-full px-3 text-[12.5px]"
                      style={{
                        fontWeight: on ? 600 : 500,
                        background: on ? 'var(--accent-surface)' : 'var(--bg-base)',
                        color: on ? 'var(--accent)' : 'var(--text-secondary)',
                        border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                      }}
                    >
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            {/* Tags */}
            <Field label="Tags" icon="tag">
              <div className="flex flex-wrap items-center gap-1.5">
                {draft.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-full bg-bg-elevated-2 px-2.5 py-1 text-[12.5px] font-medium text-text-secondary"
                  >
                    #{t}
                    <button
                      onClick={() => removeTag(t)}
                      aria-label={`Remover tag ${t}`}
                      className="grid place-items-center text-text-muted transition-colors hover:text-danger"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="Adicionar tag…"
                  className="h-8 min-w-[120px] flex-1 rounded-md border border-border bg-bg-base px-3 text-sm text-text-primary outline-none focus:border-border-strong"
                />
              </div>
            </Field>

            {/* Quadro (workspace) — só aparece se houver quadros */}
            {workspaces.length > 0 && (
              <Field label="Quadro" icon="layout-grid">
                <div className="flex flex-wrap gap-2">
                  <WorkspaceChip
                    label="Pessoal"
                    on={draft.workspaceId === null}
                    onClick={() => patch({ workspaceId: null })}
                  />
                  {workspaces.map((w) => (
                    <WorkspaceChip
                      key={w.id}
                      label={w.name}
                      color={w.color}
                      on={draft.workspaceId === w.id}
                      onClick={() => patch({ workspaceId: w.id })}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[12px] text-text-muted">
                  Num quadro, o lembrete fica visível para todos os membros.
                </p>
              </Field>
            )}

            {/* Compartilhar */}
            <Field label="Compartilhar com" icon="share-2">
              <div className="mb-2 flex gap-2">
                <div className="flex h-[42px] flex-1 items-center gap-2.5 rounded-md border border-border bg-bg-base px-3 focus-within:border-border-strong">
                  <Icon name="mail" size={15} style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void addShare()
                      }
                    }}
                    type="email"
                    placeholder="E-mail da pessoa…"
                    className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
                  />
                </div>
                <button
                  onClick={addShare}
                  disabled={shareBusy || !shareEmail.trim()}
                  className="inline-flex h-[42px] flex-none items-center gap-1.5 rounded-md border border-border bg-bg-elevated-2 px-3.5 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong disabled:opacity-50"
                >
                  {shareBusy ? (
                    <Icon name="loader-2" size={15} className="animate-spin" />
                  ) : (
                    <Icon name="plus" size={15} />
                  )}
                  Adicionar
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="mb-2.5">
                  <div className="mb-1.5 text-[12px] font-medium text-text-muted">
                    Adicionar rápido
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((p) => (
                      <button
                        key={p.userId}
                        type="button"
                        onClick={() => addKnownPerson(p)}
                        title={`Compartilhar com ${p.name}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-base py-1 pl-1 pr-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                      >
                        <span
                          className="grid h-5 w-5 flex-none place-items-center rounded-full text-[9px] font-bold text-[#0A0A0B]"
                          style={{ background: p.color }}
                        >
                          {p.initials}
                        </span>
                        {p.name.split(' ')[0]}
                        <Icon name="plus" size={13} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {shareError && <p className="mb-2 text-[12.5px] font-medium text-danger">{shareError}</p>}
              <div className="flex flex-col gap-2">
                {draft.shares.map((sh) => (
                  <div key={sh.userId} className="flex items-center gap-2.5">
                    <span
                      className="grid h-7 w-7 flex-none place-items-center rounded-full text-[11px] font-bold text-[#0A0A0B]"
                      style={{ background: sh.color }}
                    >
                      {sh.initials}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{sh.name}</span>
                    <button
                      onClick={() => toggleSharePerm(sh.userId)}
                      title="Alternar permissão (Ver/Editar)"
                      className="rounded-full border border-border bg-bg-elevated-2 px-2.5 py-[3px] text-xs font-semibold text-text-secondary transition-colors hover:border-border-strong"
                    >
                      {sh.perm === 'edit' ? 'Editar' : 'Ver'}
                    </button>
                    <button
                      onClick={() => removeShare(sh.userId)}
                      aria-label="Remover"
                      title="Remover"
                      className="grid h-7 w-7 flex-none place-items-center rounded text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-danger"
                    >
                      <Icon name="x" size={15} />
                    </button>
                  </div>
                ))}
                {draft.shares.length === 0 && (
                  <p className="text-[13px] text-text-muted">Ainda não compartilhado com ninguém.</p>
                )}
              </div>
            </Field>

            {/* Comentários — só em lembrete já existente */}
            {isEdit && draft.id && <CommentsSection noteId={draft.id} />}
          </div>

          {/* Preview */}
          <div className="flex w-full flex-none flex-col border-t border-border bg-bg-base p-5 md:w-[300px] md:border-l md:border-t-0">
            <div className="mb-3.5 text-xs font-semibold uppercase tracking-[.05em] text-text-muted">
              Prévia ao vivo
            </div>
            <ReminderCardView
              color={draft.color}
              title={draft.title || 'Título do lembrete'}
              body={draft.body || 'Os detalhes aparecem aqui conforme você escreve.'}
              priority={draft.priority}
              pinned={draft.pinned}
              time={formatRemindAt(draft.remindAt)}
              shares={draft.shares}
              tags={draft.tags}
              clampBody={false}
            />
            <div className="flex-1" />
            <button
              onClick={testFire}
              className="mt-4 flex h-[42px] w-full items-center justify-center gap-2 rounded-md border border-accent bg-transparent text-sm font-semibold text-accent transition-colors hover:bg-accent-surface"
            >
              <Icon name="zap" size={16} /> Testar disparo
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2.5 border-t border-border px-5 py-3.5">
          {error && (
            <div className="flex min-w-0 items-center gap-2 text-[13px] font-medium text-danger">
              <Icon name="alert-triangle" size={15} />
              <span className="truncate">{error}</span>
            </div>
          )}
          <div className="flex-1" />
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
            {saving ? 'Salvando…' : error ? 'Tentar de novo' : 'Salvar lembrete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function WorkspaceChip({
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
          ? 'border-accent bg-accent-surface font-semibold text-accent'
          : 'border-border bg-bg-base font-medium text-text-secondary hover:border-border-strong'
      }`}
    >
      <span
        className="h-2.5 w-2.5 flex-none rounded-full"
        style={{ background: color ?? 'var(--text-muted)' }}
      />
      {label}
    </button>
  )
}

function Field({ label, icon, children }: { label: string; icon?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        {icon && <Icon name={icon} size={15} />}
        {label}
      </div>
      {children}
    </div>
  )
}

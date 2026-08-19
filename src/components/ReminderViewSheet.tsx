import type { Perm } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { useReminders, useSetStatus } from '@/hooks/useReminders'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { canEditReminder } from '@/lib/reminders'
import { RECURRENCES, initialsFromName } from '@/lib/constants'
import { Avatar, AvatarStack, PriorityBadge } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { CommentsSection } from '@/components/editor/CommentsSection'
import { AttachmentsSection } from '@/components/editor/AttachmentsSection'

/**
 * Modal de visualização de um lembrete (clique no card). Padrão TimeTree: a "página do
 * evento" com as infos completas + a conversa da nota. Editar/Concluir só aparecem para
 * quem criou ou tem permissão (share 'edit' ou membro do quadro).
 */
export function ReminderViewSheet() {
  const viewId = useAppStore((s) => s.viewId)
  const closeView = useAppStore((s) => s.closeView)
  const openEditor = useAppStore((s) => s.openEditor)
  const showToast = useAppStore((s) => s.showToast)
  const { data: reminders = [] } = useReminders()
  const { data: workspaces = [] } = useWorkspaces()
  const setStatus = useSetStatus()

  const reminder = reminders.find((r) => r.id === viewId)
  if (!viewId || !reminder) return null

  const myWorkspaceIds = new Set(workspaces.map((w) => w.id))
  const canEdit = canEditReminder(reminder, myWorkspaceIds)
  const workspace = workspaces.find((w) => w.id === reminder.workspaceId)
  const recurrenceLabel = RECURRENCES.find((r) => r.key === reminder.recurrence)?.label ?? 'Uma vez'
  const done = reminder.status === 'archived'

  // "Visto por" (só o dono enxerga os recibos).
  const seenIds = new Set(reminder.reads.map((r) => r.userId))
  const seenNames = reminder.shares
    .filter((s) => seenIds.has(s.userId))
    .map((s) => s.name.split(' ')[0])

  const edit = () => {
    closeView()
    openEditor(reminder)
  }
  const complete = () => {
    setStatus.mutate({ id: reminder.id, status: 'archived' })
    showToast('Lembrete concluído')
    closeView()
  }
  const restore = () => {
    setStatus.mutate({ id: reminder.id, status: 'active' })
    showToast('Restaurado para Ativos')
  }

  const perms: Record<Perm, string> = { view: 'pode ver', edit: 'pode editar' }

  const actions = (
    <>
      <div className="flex-1" />
      {canEdit && !done && (
        <button
          onClick={complete}
          className="inline-flex h-[42px] items-center gap-2 rounded-md border border-border bg-bg-elevated px-4 text-sm font-semibold text-text-primary transition-colors hover:border-border-strong"
        >
          <Icon name="check" size={16} /> Concluir
        </button>
      )}
      {canEdit && done && (
        <button
          onClick={restore}
          className="inline-flex h-[42px] items-center gap-2 rounded-md border border-border bg-bg-elevated px-4 text-sm font-semibold text-text-primary transition-colors hover:border-border-strong"
        >
          <Icon name="rotate-ccw" size={15} /> Restaurar
        </button>
      )}
      {canEdit && (
        <button
          onClick={edit}
          className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Icon name="pencil" size={15} /> Editar
        </button>
      )}
    </>
  )

  return (
    <Modal
      title={reminder.kind === 'doc' ? 'Tarefa' : 'Lembrete'}
      onClose={closeView}
      maxWidth={560}
      footer={canEdit ? actions : undefined}
    >
      <div className="flex flex-col gap-5 p-5">
        {/* Cabeçalho: cor + título + badges */}
        <div>
          <div className="flex items-start gap-3">
            <span
              className="mt-1.5 h-3.5 w-3.5 flex-none rounded-full"
              style={{ background: reminder.color }}
            />
            <h1 className="min-w-0 flex-1 text-[24px] font-extrabold leading-tight tracking-[-.015em]">
              {reminder.title}
            </h1>
            {reminder.pinned && (
              <Icon name="pin" size={16} style={{ color: 'var(--accent)', transform: 'rotate(35deg)' }} />
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 pl-[26px]">
            <PriorityBadge priority={reminder.priority} />
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-text-secondary">
              <Icon name="clock" size={13} />
              {reminder.time}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-text-muted">
              <Icon name="rotate-ccw" size={12} />
              {recurrenceLabel}
            </span>
            {done && (
              <span className="rounded-full bg-bg-elevated-2 px-2.5 py-0.5 text-[11.5px] font-semibold text-success">
                Concluído
              </span>
            )}
            {workspace && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-2.5 py-0.5 text-[11.5px] font-semibold text-text-secondary">
                <span className="h-2 w-2 rounded-full" style={{ background: workspace.color }} />
                {workspace.name}
              </span>
            )}
          </div>
        </div>

        {/* Corpo */}
        {reminder.body && (
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-text-secondary">
            {reminder.body}
          </p>
        )}

        {/* Tags */}
        {reminder.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {reminder.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 rounded-full bg-bg-elevated-2 px-2.5 py-1 text-[12px] font-medium text-text-secondary"
              >
                <span className="text-text-muted">#</span>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Pessoas: criado por + compartilhado com */}
        <div className="rounded-md border border-border bg-bg-base px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <Avatar
              initials={initialsFromName(reminder.ownerName)}
              color={reminder.ownerColor}
              size={26}
              ringColor="var(--bg-base)"
            />
            <span className="text-[13px] text-text-secondary">
              Criado por{' '}
              <span className="font-semibold text-text-primary">
                {reminder.mine ? 'você' : reminder.ownerName}
              </span>
            </span>
          </div>
          {reminder.shares.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2.5 border-t border-border pt-2.5">
              <AvatarStack shares={reminder.shares} size={24} ring="var(--bg-base)" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-secondary">
                {reminder.shares
                  .map((s) => `${s.name.split(' ')[0]} ${perms[s.perm]}`)
                  .join(' · ')}
              </span>
            </div>
          )}
          {reminder.mine && reminder.shares.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-[12px]">
              <Icon
                name="eye"
                size={12}
                style={{ color: seenNames.length ? 'var(--accent)' : 'var(--text-muted)' }}
              />
              <span className={seenNames.length ? 'text-text-secondary' : 'text-text-muted'}>
                {seenNames.length ? `Visto por ${seenNames.join(', ')}` : 'Ninguém viu ainda'}
              </span>
            </div>
          )}
        </div>

        {/* Anexos (quem vê a nota pode ver/anexar; apagar segue as regras) */}
        <AttachmentsSection noteId={reminder.id} />

        {/* Conversa da nota */}
        <CommentsSection noteId={reminder.id} />
      </div>
    </Modal>
  )
}

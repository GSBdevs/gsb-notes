import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import type { WorkspaceRole } from '@/types'
import {
  useAddWorkspaceMember,
  useAddWorkspaceMemberByUser,
  useDeleteWorkspace,
  useLeaveWorkspace,
  useRemoveWorkspaceMember,
  useSetMemberRole,
  useUpdateWorkspace,
  useWorkspaceMembers,
  useWorkspaces,
} from '@/hooks/useWorkspaces'
import { usePeople } from '@/hooks/usePeople'
import { CARD_COLORS, personIsOnline } from '@/lib/constants'
import { hasSupabase } from '@/services/supabase'
import { Avatar } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Dono',
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Somente ver',
}

/** Painel de gestão de um quadro: renome/cor + membros com papéis; excluir (dono) ou sair (membro). */
export function WorkspaceSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: workspaces = [] } = useWorkspaces()
  const { data: members = [] } = useWorkspaceMembers(id)
  const { data: people = [] } = usePeople()
  const onlineIds = useAppStore((s) => s.onlineIds)
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useAppStore((s) => s.setActiveWorkspace)
  const showToast = useAppStore((s) => s.showToast)

  const update = useUpdateWorkspace()
  const del = useDeleteWorkspace()
  const leave = useLeaveWorkspace()
  const addMember = useAddWorkspaceMember()
  const addMemberByUser = useAddWorkspaceMemberByUser()
  const removeMember = useRemoveWorkspaceMember()
  const setRole = useSetMemberRole()

  const ws = workspaces.find((w) => w.id === id)

  const [name, setName] = useState(ws?.name ?? '')
  const [color, setColor] = useState(ws?.color ?? '#FACC15')
  const [email, setEmail] = useState('')
  const [memberError, setMemberError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Sincroniza os campos quando o quadro carrega/muda.
  useEffect(() => {
    if (ws) {
      setName(ws.name)
      setColor(ws.color)
    }
  }, [ws?.id, ws?.name, ws?.color]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fecha se o quadro sumir (excluído ou você saiu).
  useEffect(() => {
    if (!ws) onClose()
  }, [ws, onClose])

  if (!ws) return null

  const mine = ws.mine // dono do quadro
  const isAdmin = mine || ws.myRole === 'admin' // dono ou admin gerencia membros
  const dirty = name.trim() !== ws.name || color !== ws.color

  const closeAndResetActive = () => {
    if (activeWorkspaceId === id) setActiveWorkspace(null)
    onClose()
  }

  const saveMeta = () => {
    if (!dirty) return
    update.mutate({ id, patch: { name: name.trim(), color } })
    showToast('Quadro atualizado')
  }

  const doAddMember = async () => {
    const value = email.trim()
    setMemberError(null)
    if (!value) return
    setBusy(true)
    try {
      const added = await addMember.mutateAsync({ id, email: value })
      if (!added) setMemberError('Nenhum usuário com esse e-mail, ou já é membro.')
      else {
        setEmail('')
        showToast(`${added.name.split(' ')[0]} entrou no quadro`)
      }
    } catch {
      setMemberError('Não foi possível adicionar. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  // "Adicionar rápido": contatos conhecidos que ainda não são membros (mesma UX dos lembretes).
  const memberIds = new Set(members.map((m) => m.userId))
  const suggestions = people.filter((p) => !memberIds.has(p.userId))

  const doAddKnown = async (userId: string, personName: string) => {
    setMemberError(null)
    try {
      const added = await addMemberByUser.mutateAsync({ id, userId })
      if (added) showToast(`${personName.split(' ')[0]} entrou no quadro`)
      else setMemberError('Essa pessoa já é membro.')
    } catch {
      setMemberError('Não foi possível adicionar. Tente de novo.')
    }
  }

  const doRemoveMember = (userId: string, memberName: string) => {
    removeMember.mutate({ id, userId })
    showToast(`${memberName.split(' ')[0]} saiu do quadro`)
  }

  const doDelete = () => {
    del.mutate(id)
    showToast('Quadro excluído')
    closeAndResetActive()
  }

  const doLeave = () => {
    leave.mutate(id)
    showToast('Você saiu do quadro')
    closeAndResetActive()
  }

  return (
    <Modal title="Quadro" onClose={onClose}>
      <div className="flex flex-col gap-[22px] p-5">
        {/* Identidade / renome */}
        <section>
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 flex-none rounded-full" style={{ background: color }} />
            {mine ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="min-w-0 flex-1 bg-transparent text-lg font-bold tracking-[-.01em] text-text-primary outline-none"
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-lg font-bold tracking-[-.01em]">{ws.name}</span>
            )}
          </div>
          {mine && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {CARD_COLORS.map((c) => {
                const on = color === c.hex
                return (
                  <button
                    key={c.hex}
                    title={c.name}
                    onClick={() => setColor(c.hex)}
                    className="h-7 w-7 rounded-full transition-transform hover:scale-105"
                    style={{
                      background: c.hex,
                      border: `2px solid ${on ? 'var(--text-primary)' : 'transparent'}`,
                    }}
                  />
                )
              })}
              <div className="flex-1" />
              <button
                onClick={saveMeta}
                disabled={!dirty}
                className="h-9 rounded-md bg-accent px-3.5 text-[13px] font-semibold text-text-on-accent transition-opacity disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          )}
        </section>

        {/* Membros */}
        <section>
          <SectionLabel>
            Membros {members.length > 0 && <span className="text-text-muted">· {members.length}</span>}
          </SectionLabel>

          {isAdmin && (
            <div className="mb-2.5">
              <div className="flex gap-2">
                <div className="flex h-[42px] flex-1 items-center gap-2.5 rounded-md border border-border bg-bg-base px-3 focus-within:border-border-strong">
                  <Icon name="mail" size={15} style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void doAddMember()
                      }
                    }}
                    type="email"
                    placeholder="Adicionar por e-mail…"
                    className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
                  />
                </div>
                <button
                  onClick={doAddMember}
                  disabled={busy || !email.trim()}
                  className="inline-flex h-[42px] flex-none items-center gap-1.5 rounded-md border border-border bg-bg-elevated-2 px-3.5 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong disabled:opacity-50"
                >
                  {busy ? <Icon name="loader-2" size={15} className="animate-spin" /> : <Icon name="plus" size={15} />}
                  Adicionar
                </button>
              </div>
              {suggestions.length > 0 && (
                <div className="mt-2.5">
                  <div className="mb-1.5 text-[12px] font-medium text-text-muted">Adicionar rápido</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((p) => (
                      <button
                        key={p.userId}
                        type="button"
                        onClick={() => void doAddKnown(p.userId, p.name)}
                        disabled={addMemberByUser.isPending}
                        title={`Adicionar ${p.name} ao quadro`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-base py-1 pl-1 pr-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
                      >
                        <span
                          className="grid h-5 w-5 flex-none place-items-center overflow-hidden rounded-full text-[9px] font-bold text-[#0A0A0B]"
                          style={{ background: p.color }}
                        >
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            p.initials
                          )}
                        </span>
                        {p.name.split(' ')[0]}
                        <Icon name="plus" size={13} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {memberError && <p className="mt-2 text-[12.5px] font-medium text-danger">{memberError}</p>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {members.map((m) => {
              const online = personIsOnline(m.userId, onlineIds, false, hasSupabase)
              return (
                <div
                  key={m.userId}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-bg-base px-3 py-2"
                >
                  <Avatar
                    initials={m.initials}
                    color={m.color}
                    src={m.avatarUrl}
                    size={30}
                    presence={online ? 'online' : 'offline'}
                    ringColor="var(--bg-base)"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{m.name}</span>
                  {m.isOwner ? (
                    <span className="rounded-full bg-accent-surface px-2.5 py-0.5 text-xs font-semibold text-accent-ink">
                      Dono
                    </span>
                  ) : (
                    <div className="flex flex-none items-center gap-1.5">
                      {mine ? (
                        <select
                          value={m.role}
                          onChange={(e) => setRole.mutate({ id, userId: m.userId, role: e.target.value as WorkspaceRole })}
                          aria-label={`Papel de ${m.name}`}
                          className="h-8 rounded-md border border-border bg-bg-elevated-2 px-2 text-xs font-semibold text-text-secondary outline-none focus:border-border-strong"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Membro</option>
                          <option value="viewer">Somente ver</option>
                        </select>
                      ) : (
                        <span className="rounded-full bg-bg-elevated-2 px-2.5 py-0.5 text-xs font-semibold text-text-muted">
                          {ROLE_LABELS[m.role]}
                        </span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => doRemoveMember(m.userId, m.name)}
                          aria-label={`Remover ${m.name}`}
                          title="Remover do quadro"
                          className="grid h-7 w-7 flex-none place-items-center rounded text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-danger"
                        >
                          <Icon name="x" size={15} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Zona de risco */}
        <section>
          {mine ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#ef444480] bg-[#ef44441a] p-2.5">
                <span className="flex-1 px-1 text-[13px] font-medium text-danger">
                  Excluir "{ws.name}"? Os lembretes voltam a ser pessoais.
                </span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px] font-medium text-text-secondary hover:border-border-strong"
                >
                  Cancelar
                </button>
                <button
                  onClick={doDelete}
                  className="h-9 rounded-md bg-danger px-3 text-[13px] font-semibold text-white"
                >
                  Excluir
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg-base text-sm font-semibold text-danger transition-colors hover:border-danger hover:bg-[#ef44441a]"
              >
                <Icon name="trash-2" size={16} />
                Excluir quadro
              </button>
            )
          ) : (
            <button
              onClick={doLeave}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg-base text-sm font-semibold text-danger transition-colors hover:border-danger hover:bg-[#ef44441a]"
            >
              <Icon name="log-out" size={16} />
              Sair do quadro
            </button>
          )}
        </section>
      </div>
    </Modal>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
      {children}
    </div>
  )
}

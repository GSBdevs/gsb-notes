import { useState } from 'react'
import type { AdminUser } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { initialsFromName } from '@/lib/constants'
import {
  useAdminUserNotes,
  useAdminUsers,
  useMyRole,
  useResetUserPassword,
  useSetUserRole,
} from '@/hooks/useAdmin'
import { Avatar } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

/**
 * Painel do MASTER (migração 0024). Só o master acessa (rota e nav já são liberadas por papel).
 * Lista todos os usuários, permite definir admin/member, trocar a senha (via Edge Function) e ver
 * as notas de cada um. O tipo de conta é OCULTO para os demais — só aqui aparece.
 */
export function AdminScreen() {
  const { data: role, isLoading: roleLoading } = useMyRole()
  const isMaster = role === 'master'
  const { data: users = [], isLoading } = useAdminUsers(isMaster)
  const showToast = useAppStore((s) => s.showToast)

  const [resetFor, setResetFor] = useState<AdminUser | null>(null)
  const [notesFor, setNotesFor] = useState<AdminUser | null>(null)

  if (roleLoading) return <p className="px-1 py-10 text-sm text-text-muted">Carregando…</p>
  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
        <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-bg-elevated text-text-muted">
          <Icon name="alert-triangle" size={26} />
        </div>
        <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">Acesso restrito</h3>
        <p className="max-w-[340px] text-sm">Esta área é exclusiva da conta master.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-5">
        <h2 className="text-lg font-bold tracking-[-.01em]">Usuários</h2>
        <p className="mt-0.5 text-[13px] text-text-muted">
          Defina o papel de cada conta, redefina senhas e veja os dados. O papel não aparece para o usuário.
        </p>
      </div>

      {isLoading ? (
        <p className="px-1 py-10 text-sm text-text-muted">Carregando usuários…</p>
      ) : users.length === 0 ? (
        <p className="px-1 py-10 text-sm text-text-muted">Nenhum usuário encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u) => (
            <UserRow
              key={u.userId}
              user={u}
              onReset={() => setResetFor(u)}
              onViewNotes={() => setNotesFor(u)}
              onRoleChanged={(label) => showToast(label)}
            />
          ))}
        </div>
      )}

      {resetFor && (
        <ResetPasswordModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={() => {
            showToast('Senha redefinida')
            setResetFor(null)
          }}
        />
      )}
      {notesFor && <UserNotesModal user={notesFor} onClose={() => setNotesFor(null)} />}
    </>
  )
}

function UserRow({
  user: u,
  onReset,
  onViewNotes,
  onRoleChanged,
}: {
  user: AdminUser
  onReset: () => void
  onViewNotes: () => void
  onRoleChanged: (label: string) => void
}) {
  const setRole = useSetUserRole()
  const isMasterRow = u.role === 'master'

  const changeRole = (role: 'admin' | 'member') => {
    if (role === u.role) return
    setRole.mutate(
      { userId: u.userId, role },
      { onSuccess: () => onRoleChanged(role === 'admin' ? 'Agora é admin' : 'Agora é membro') },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-elevated px-3.5 py-3">
      <Avatar initials={initialsFromName(u.name)} color={u.color} src={u.avatarUrl ?? undefined} size={38} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{u.name}</div>
        <div className="truncate text-[12.5px] text-text-muted">{u.email}</div>
      </div>

      {isMasterRow ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-surface px-3 py-1 text-[12.5px] font-semibold text-accent-ink">
          <Icon name="sparkles" size={13} /> Master
        </span>
      ) : (
        <div className="flex flex-none items-center rounded-md border border-border bg-bg-base p-0.5">
          {(['admin', 'member'] as const).map((r) => {
            const on = u.role === r
            return (
              <button
                key={r}
                onClick={() => changeRole(r)}
                disabled={setRole.isPending}
                aria-pressed={on}
                className={`rounded-[5px] px-2.5 py-1 text-xs font-semibold transition-colors ${
                  on ? 'bg-accent text-text-on-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {r === 'admin' ? 'Admin' : 'Membro'}
              </button>
            )
          })}
        </div>
      )}

      <button
        onClick={onViewNotes}
        title="Ver notas"
        className="grid h-9 w-9 flex-none place-items-center rounded-md border border-border bg-bg-base text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
      >
        <Icon name="eye" size={16} />
      </button>
      {!isMasterRow && (
        <button
          onClick={onReset}
          className="inline-flex h-9 flex-none items-center gap-1.5 rounded-md border border-border bg-bg-base px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <Icon name="settings" size={15} /> Senha
        </button>
      )}
    </div>
  )
}

function ResetPasswordModal({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser
  onClose: () => void
  onDone: () => void
}) {
  const reset = useResetUserPassword()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    if (password.length < 6) {
      setError('A senha precisa de ao menos 6 caracteres.')
      return
    }
    reset.mutate(
      { userId: user.userId, password },
      { onSuccess: onDone, onError: (e) => setError(e instanceof Error ? e.message : 'Falha ao redefinir.') },
    )
  }

  return (
    <Modal
      title="Redefinir senha"
      onClose={onClose}
      footer={
        <>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="h-[42px] rounded-md border border-border bg-transparent px-[18px] text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={reset.isPending}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            {reset.isPending && <Icon name="loader-2" size={16} className="animate-spin" />}
            Salvar senha
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <p className="text-[13.5px] text-text-secondary">
          Defina uma nova senha para <span className="font-semibold text-text-primary">{user.name}</span>.
          Informe a nova senha ao usuário — você não vê a senha antiga.
        </p>
        <input
          type="text"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !reset.isPending && submit()}
          placeholder="Nova senha (mín. 6 caracteres)"
          className="h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-[#ef444480] bg-[#ef44441a] px-3 py-2.5 text-[13px] font-medium text-danger">
            <Icon name="alert-triangle" size={15} className="mt-px flex-none" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

const KIND_LABEL: Record<string, string> = { reminder: 'Lembrete', doc: 'Tarefa', block: 'Bloco' }

function UserNotesModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { data: notes = [], isLoading } = useAdminUserNotes(user.userId)
  return (
    <Modal title={`Notas de ${user.name}`} onClose={onClose}>
      <div className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto p-5">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-text-muted">Carregando…</p>
        ) : notes.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">Este usuário não tem notas.</p>
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-2.5 rounded-md border border-border bg-bg-base px-3 py-2.5"
            >
              <span className="rounded bg-bg-elevated-2 px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
                {KIND_LABEL[n.kind] ?? n.kind}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                {n.title || 'Sem título'}
              </span>
              {n.status === 'archived' && (
                <span className="text-[11px] font-semibold text-text-muted">concluído</span>
              )}
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}

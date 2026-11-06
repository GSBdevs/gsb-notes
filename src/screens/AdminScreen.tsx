import { useState } from 'react'
import type { AdminUser } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { initialsFromName } from '@/lib/constants'
import {
  useAdminUserNotes,
  useAdminUsers,
  useCreateUser,
  useMyRole,
  useResetUserPassword,
  useSetUserBlocked,
  useSetUserRole,
} from '@/hooks/useAdmin'
import { Avatar } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

/**
 * Painel do MASTER (migração 0024). Só o master acessa (rota e nav já são liberadas por papel).
 * Lista todos os usuários, permite criar contas (login restrito, doc 22), definir o papel, bloquear,
 * trocar a senha (via Edge Function) e ver as notas de cada um. O tipo de conta é OCULTO para os demais — só aqui aparece.
 */
export function AdminScreen() {
  const { data: role, isLoading: roleLoading } = useMyRole()
  const isMaster = role === 'master'
  const { data: users = [], isLoading } = useAdminUsers(isMaster)
  const showToast = useAppStore((s) => s.showToast)

  const [resetFor, setResetFor] = useState<AdminUser | null>(null)
  const [notesFor, setNotesFor] = useState<AdminUser | null>(null)
  const [creating, setCreating] = useState(false)

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
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-[260px]">
          <h2 className="text-lg font-bold tracking-[-.01em]">Usuários</h2>
          <p className="mt-0.5 text-[13px] text-text-muted">
            Crie e bloqueie acessos, defina o papel de cada conta, redefina senhas e veja os dados. O papel não
            aparece para o usuário.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex h-10 flex-none items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Icon name="user-plus" size={16} /> Novo usuário
        </button>
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
              onError={(message) => showToast(message)}
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
      {creating && (
        <NewUserModal
          onClose={() => setCreating(false)}
          onDone={() => {
            showToast('Usuário criado')
            setCreating(false)
          }}
        />
      )}
    </>
  )
}

function UserRow({
  user: u,
  onReset,
  onViewNotes,
  onRoleChanged,
  onError,
}: {
  user: AdminUser
  onReset: () => void
  onViewNotes: () => void
  onRoleChanged: (label: string) => void
  onError: (message: string) => void
}) {
  const setRole = useSetUserRole()
  const setBlocked = useSetUserBlocked()
  const isMasterRow = u.role === 'master'

  const changeRole = (role: 'admin' | 'suporte' | 'member') => {
    if (role === u.role) return
    setRole.mutate(
      { userId: u.userId, role },
      { onSuccess: () => onRoleChanged(`Agora é ${ROLE_LABEL[role].toLowerCase()}`) },
    )
  }

  const toggleBlocked = () => {
    const blocked = !u.blocked
    setBlocked.mutate(
      { userId: u.userId, blocked },
      {
        onSuccess: () => onRoleChanged(blocked ? 'Acesso bloqueado' : 'Acesso liberado'),
        onError: (e) => onError(e instanceof Error ? e.message : 'Falha ao alterar o acesso.'),
      },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg-elevated px-3.5 py-3">
      <Avatar initials={initialsFromName(u.name)} color={u.color} src={u.avatarUrl ?? undefined} size={38} />
      <div className="min-w-0 flex-1 basis-[190px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[14px] font-semibold">{u.name}</span>
          {u.blocked && (
            <span className="flex-none rounded-full border border-[#ef444480] bg-[#ef44441a] px-2 py-px text-[11px] font-semibold text-danger">
              Bloqueado
            </span>
          )}
        </div>
        <div className="truncate text-[12.5px] text-text-muted">{u.email}</div>
      </div>

      {isMasterRow ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent bg-accent-surface px-3 py-1 text-[12.5px] font-semibold text-accent-ink">
          <Icon name="sparkles" size={13} /> Master
        </span>
      ) : (
        <div className="flex flex-none items-center rounded-md border border-border bg-bg-base p-0.5">
          {/* Suporte (0038): gerencia a Logística junto com Admin e Master. */}
          {(['admin', 'suporte', 'member'] as const).map((r) => {
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
                {ROLE_LABEL[r]}
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
      {!isMasterRow && (
        <button
          onClick={toggleBlocked}
          disabled={setBlocked.isPending}
          className="inline-flex h-9 flex-none items-center gap-1.5 rounded-md border border-border bg-bg-base px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-70"
        >
          <Icon name={u.blocked ? 'lock-open' : 'lock'} size={15} /> {u.blocked ? 'Liberar' : 'Bloquear'}
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

function NewUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const create = useCreateUser()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'suporte' | 'member'>('member')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    if (!name.trim() || !email.trim()) {
      setError('Preencha o nome e o e-mail.')
      return
    }
    if (password.length < 6) {
      setError('A senha precisa de ao menos 6 caracteres.')
      return
    }
    create.mutate(
      { name: name.trim(), email: email.trim(), password, role },
      { onSuccess: onDone, onError: (e) => setError(e instanceof Error ? e.message : 'Falha ao criar.') },
    )
  }

  const field =
    'h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent'
  const label = 'mb-1.5 block text-[13px] font-medium text-text-secondary'

  return (
    <Modal
      title="Novo usuário"
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
            disabled={create.isPending}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            {create.isPending && <Icon name="loader-2" size={16} className="animate-spin" />}
            Criar usuário
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <div>
          <label className={label}>Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" className={field} />
        </div>
        <div>
          <label className={label}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            placeholder="pessoa@exemplo.com"
            className={field}
          />
        </div>
        <div>
          <label className={label}>Senha inicial</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
            placeholder="Mín. 6 caracteres"
            className={field}
          />
          <p className="mt-1.5 text-[12.5px] text-text-muted">
            Passe esta senha para a pessoa. No primeiro acesso, ela define uma senha própria.
          </p>
        </div>
        <div>
          <label className={label}>Papel</label>
          <div className="inline-flex items-center rounded-md border border-border bg-bg-base p-0.5">
            {(['member', 'suporte', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                aria-pressed={role === r}
                className={`rounded-[5px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                  role === r ? 'bg-accent text-text-on-accent' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
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

const ROLE_LABEL = { admin: 'Admin', suporte: 'Suporte', member: 'Membro' } as const

const KIND_LABEL: Record<string, string> = { reminder: 'Lembrete', doc: 'Tarefa', block: 'Bloco', call: 'Chamado', route: 'Rota' }

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

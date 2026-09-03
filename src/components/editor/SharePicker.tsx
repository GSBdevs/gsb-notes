import { useState } from 'react'
import type { Person, Share } from '@/types'
import { usePeople } from '@/hooks/usePeople'
import { notesService } from '@/services/notesService'
import { Icon } from '@/components/ui/Icon'

interface Props {
  shares: Share[]
  onChange: (shares: Share[]) => void
  /** Só o dono gerencia; para não-donos, mostra a lista em modo leitura. */
  canManage: boolean
  /**
   * Pessoas que NÃO devem entrar na lista 1:1 porque já têm acesso por outro meio
   * (ex.: membros do quadro a que a nota pertence). Some das sugestões e é barrada por e-mail.
   */
  excludeUserIds?: string[]
  /** Rótulo do motivo da exclusão, exibido ao usuário (ex.: "já faz parte do quadro"). */
  excludeReason?: string
}

/**
 * Seletor de pessoas de um lembrete/tarefa: adicionar por e-mail, sugestões de 1 clique
 * (pessoas conhecidas + contatos), permissão Ver/Editar e remoção. Reusado nos dois editores.
 */
export function SharePicker({ shares, onChange, canManage, excludeUserIds = [], excludeReason }: Props) {
  const { data: people = [] } = usePeople()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const excluded = new Set(excludeUserIds)
  const reason = excludeReason ?? 'já tem acesso'

  const add = async () => {
    const value = email.trim()
    setError(null)
    if (!value) return
    setBusy(true)
    try {
      const person = await notesService.findPersonByEmail(value)
      if (!person) {
        setError('Nenhum usuário com esse e-mail.')
      } else if (excluded.has(person.userId)) {
        setError(`Essa pessoa ${reason} — não precisa compartilhar de novo.`)
      } else if (shares.some((s) => s.userId === person.userId)) {
        setError('Essa pessoa já está na lista.')
      } else {
        onChange([...shares, person])
        setEmail('')
      }
    } catch {
      setError('Não foi possível buscar. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const addKnown = (p: Person) => {
    if (shares.some((s) => s.userId === p.userId)) return
    setError(null)
    onChange([
      ...shares,
      { userId: p.userId, name: p.name, initials: p.initials, color: p.color, avatarUrl: p.avatarUrl, perm: 'view' },
    ])
  }

  const togglePerm = (userId: string) =>
    onChange(
      shares.map((s) =>
        s.userId === userId ? { ...s, perm: s.perm === 'edit' ? 'view' : 'edit' } : s,
      ),
    )

  const remove = (userId: string) => onChange(shares.filter((s) => s.userId !== userId))

  const suggestions = people.filter(
    (p) => !shares.some((s) => s.userId === p.userId) && !excluded.has(p.userId),
  )

  return (
    <div>
      {canManage && (
        <>
          <div className="mb-2 flex gap-2">
            <div className="flex h-[42px] flex-1 items-center gap-2.5 rounded-md border border-border bg-bg-base px-3 focus-within:border-border-strong">
              <Icon name="mail" size={15} style={{ color: 'var(--text-muted)' }} />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void add()
                  }
                }}
                type="email"
                placeholder="E-mail da pessoa…"
                className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
              />
            </div>
            <button
              onClick={add}
              disabled={busy || !email.trim()}
              className="inline-flex h-[42px] flex-none items-center gap-1.5 rounded-md border border-border bg-bg-elevated-2 px-3.5 text-[13px] font-semibold text-text-primary transition-colors hover:border-border-strong disabled:opacity-50"
            >
              {busy ? (
                <Icon name="loader-2" size={15} className="animate-spin" />
              ) : (
                <Icon name="plus" size={15} />
              )}
              Adicionar
            </button>
          </div>
          {suggestions.length > 0 && (
            <div className="mb-2.5">
              <div className="mb-1.5 text-[12px] font-medium text-text-muted">Adicionar rápido</div>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((p) => (
                  <button
                    key={p.userId}
                    type="button"
                    onClick={() => addKnown(p)}
                    title={`Compartilhar com ${p.name}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-base py-1 pl-1 pr-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
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
          {excluded.size > 0 && (
            <p className="mb-2 text-[12px] text-text-muted">
              Membros do quadro já veem esta nota — aqui você adiciona só quem está de fora dele.
            </p>
          )}
          {error && <p className="mb-2 text-[12.5px] font-medium text-danger">{error}</p>}
        </>
      )}

      <div className="flex flex-col gap-2">
        {shares.map((sh) => (
          <div key={sh.userId} className="flex items-center gap-2.5">
            <span
              className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-full text-[11px] font-bold text-[#0A0A0B]"
              style={{ background: sh.color }}
            >
              {sh.avatarUrl ? (
                <img src={sh.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                sh.initials
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{sh.name}</span>
            {canManage ? (
              <>
                <button
                  onClick={() => togglePerm(sh.userId)}
                  title="Alternar permissão (Ver/Editar)"
                  className="rounded-full border border-border bg-bg-elevated-2 px-2.5 py-[3px] text-xs font-semibold text-text-secondary transition-colors hover:border-border-strong"
                >
                  {sh.perm === 'edit' ? 'Editar' : 'Ver'}
                </button>
                <button
                  onClick={() => remove(sh.userId)}
                  aria-label="Remover"
                  title="Remover"
                  className="grid h-7 w-7 flex-none place-items-center rounded text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-danger"
                >
                  <Icon name="x" size={15} />
                </button>
              </>
            ) : (
              <span className="rounded-full bg-bg-elevated-2 px-2.5 py-[3px] text-xs font-semibold text-text-muted">
                {sh.perm === 'edit' ? 'Editar' : 'Ver'}
              </span>
            )}
          </div>
        ))}
        {shares.length === 0 && (
          <p className="text-[13px] text-text-muted">
            {canManage ? 'Ainda não compartilhado com ninguém.' : 'Sem outras pessoas.'}
          </p>
        )}
      </div>
      {!canManage && (
        <p className="mt-2 text-[12px] text-text-muted">Só quem criou gerencia o compartilhamento.</p>
      )}
    </div>
  )
}

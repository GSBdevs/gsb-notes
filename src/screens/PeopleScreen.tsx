import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { usePeople } from '@/hooks/usePeople'
import { useContactInvites, useRespondContactInvite, useSendContactInvite } from '@/hooks/useContactInvites'
import { personIsOnline } from '@/lib/constants'
import { hasSupabase } from '@/services/supabase'
import { Avatar } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'

export function PeopleScreen() {
  const { data: people = [] } = usePeople()
  const { data: invites = [] } = useContactInvites()
  const openPerson = useAppStore((s) => s.openPerson)
  const showToast = useAppStore((s) => s.showToast)
  const onlineIds = useAppStore((s) => s.onlineIds)
  const sendInvite = useSendContactInvite()
  const respond = useRespondContactInvite()

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = async () => {
    const value = email.trim()
    setError(null)
    if (!value) return
    try {
      const outcome = await sendInvite.mutateAsync(value)
      switch (outcome) {
        case 'sent':
          setEmail('')
          showToast('Convite enviado')
          break
        case 'accepted':
          setEmail('')
          showToast('Convite aceito — vocês agora são contatos')
          break
        case 'already-pending':
          setError('Você já enviou um convite para essa pessoa.')
          break
        case 'already-contact':
          setError('Essa pessoa já é seu contato.')
          break
        case 'not-found':
          setError('Nenhum usuário com esse e-mail.')
          break
      }
    } catch {
      setError('Não foi possível enviar. Verifique a conexão e tente de novo.')
    }
  }

  const incoming = invites.filter((i) => i.direction === 'incoming')
  const outgoing = invites.filter((i) => i.direction === 'outgoing')
  const contacts = people.filter((p) => p.isContact)
  const sharing = people.filter((p) => !p.isContact)

  return (
    <div className="mx-auto max-w-[760px]">
      {/* Adicionar pessoa */}
      <div className="mb-[22px] rounded-md border border-border bg-bg-elevated p-4">
        <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
          <Icon name="user-plus" size={14} />
          Convidar pessoa
        </div>
        <div className="flex gap-2">
          <div className="flex h-11 flex-1 items-center gap-2.5 rounded-md border border-border bg-bg-base px-3 focus-within:border-border-strong">
            <Icon name="mail" size={15} style={{ color: 'var(--text-muted)' }} />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void add()}
              type="email"
              placeholder="E-mail da pessoa…"
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
            />
          </div>
          <button
            onClick={add}
            disabled={sendInvite.isPending || !email.trim()}
            className="inline-flex h-11 flex-none items-center gap-1.5 rounded-md bg-accent px-4 text-[13.5px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {sendInvite.isPending ? (
              <Icon name="loader-2" size={15} className="animate-spin" />
            ) : (
              <Icon name="send" size={15} />
            )}
            Convidar
          </button>
        </div>
        {error ? (
          <p className="mt-2 text-[12.5px] font-medium text-danger">{error}</p>
        ) : (
          <p className="mt-2 text-[12px] text-text-muted">
            A pessoa precisa ter conta no SB Notas. Ela recebe um convite e, ao aceitar, vocês dois
            viram contato um do outro — aparecendo nas sugestões de compartilhamento.
          </p>
        )}
      </div>

      {/* Convites recebidos */}
      {incoming.length > 0 && (
        <>
          <SectionTitle>
            Convites recebidos <span className="text-text-muted">· {incoming.length}</span>
          </SectionTitle>
          <div className="mb-[26px] flex flex-col gap-2">
            {incoming.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 rounded-md border border-accent/40 bg-accent-surface px-3.5 py-3"
              >
                <Avatar initials={inv.initials} color={inv.color} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{inv.name}</div>
                  <div className="text-[13px] text-text-muted">quer te adicionar como contato</div>
                </div>
                <button
                  onClick={() => respond.mutate({ id: inv.id, accept: true })}
                  disabled={respond.isPending}
                  className="inline-flex h-9 flex-none items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  <Icon name="check" size={14} /> Aceitar
                </button>
                <button
                  onClick={() => respond.mutate({ id: inv.id, accept: false })}
                  disabled={respond.isPending}
                  className="inline-flex h-9 flex-none items-center rounded-md border border-border px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
                >
                  Recusar
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Convites enviados */}
      {outgoing.length > 0 && (
        <>
          <SectionTitle>
            Convites enviados <span className="text-text-muted">· {outgoing.length}</span>
          </SectionTitle>
          <div className="mb-[26px] flex flex-col gap-2">
            {outgoing.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 rounded-md border border-border bg-bg-elevated px-3.5 py-3"
              >
                <Avatar initials={inv.initials} color={inv.color} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{inv.name}</div>
                  <div className="text-[13px] text-text-muted">convite pendente</div>
                </div>
                <span className="rounded-full bg-bg-elevated-2 px-2.5 py-1 text-xs font-semibold text-text-muted">
                  Aguardando
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Compartilhando com */}
      <SectionTitle>
        Compartilhando com {sharing.length > 0 && <span className="text-text-muted">· {sharing.length}</span>}
      </SectionTitle>
      {sharing.length > 0 ? (
        <div className="mb-[26px] flex flex-col gap-2">
          {sharing.map((p) => (
            <PersonRow key={p.userId} person={p} onlineIds={onlineIds} onOpen={openPerson} />
          ))}
        </div>
      ) : (
        <p className="mb-[26px] rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-text-muted">
          Você ainda não compartilha lembretes com ninguém.
        </p>
      )}

      {/* Contatos (sem compartilhamento ainda) */}
      {contacts.length > 0 && (
        <>
          <SectionTitle>
            Contatos <span className="text-text-muted">· {contacts.length}</span>
          </SectionTitle>
          <div className="flex flex-col gap-2">
            {contacts.map((p) => (
              <PersonRow key={p.userId} person={p} onlineIds={onlineIds} onOpen={openPerson} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PersonRow({
  person: p,
  onlineIds,
  onOpen,
}: {
  person: import('@/types').Person
  onlineIds: string[]
  onOpen: (id: string) => void
}) {
  const online = personIsOnline(p.userId, onlineIds, p.online, hasSupabase)
  return (
    <button
      onClick={() => onOpen(p.userId)}
      className="group flex items-center gap-3 rounded-md border border-border bg-bg-elevated px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-bg-elevated-2"
    >
      <Avatar
        initials={p.initials}
        color={p.color}
        src={p.avatarUrl}
        size={38}
        presence={online ? 'online' : 'offline'}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{p.name}</div>
        <div className="text-[13px] text-text-muted">{online ? 'Online agora' : 'Offline'}</div>
      </div>
      {p.isContact ? (
        <span className="rounded-full bg-bg-elevated-2 px-2.5 py-1 text-xs font-semibold text-text-muted">
          Contato
        </span>
      ) : (
        <span
          className="rounded-full bg-bg-elevated-2 px-2.5 py-1 text-xs font-semibold"
          style={{ color: p.perm === 'edit' ? 'var(--accent)' : 'var(--text-secondary)' }}
        >
          {p.perm === 'edit' ? 'Editar' : 'Ver'}
        </span>
      )}
      <Icon
        name="chevron-right"
        size={16}
        className="text-text-muted transition-colors group-hover:text-text-secondary"
      />
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
      {children}
    </h3>
  )
}

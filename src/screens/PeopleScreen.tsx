import { usePeople } from '@/hooks/usePeople'
import { Avatar } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'

export function PeopleScreen() {
  const { data: people = [] } = usePeople()

  return (
    <div className="max-w-[640px]">
      {/* Convidar */}
      <div className="mb-[22px] flex h-11 items-center gap-2.5 rounded-md border border-border bg-bg-elevated px-3">
        <Icon name="user-plus" size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          placeholder="Convidar por e-mail…"
          className="flex-1 bg-transparent text-sm text-text-primary outline-none"
        />
        <button className="h-[30px] rounded-sm bg-accent px-3.5 text-[13px] font-semibold text-text-on-accent">
          Convidar
        </button>
      </div>

      {/* Convites recebidos */}
      <SectionTitle>Convites recebidos</SectionTitle>
      <div className="mb-[26px] flex items-center gap-3 rounded-md border border-border bg-bg-elevated p-3.5">
        <Avatar initials="MB" color="var(--accent)" size={38} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Marina Braga</div>
          <div className="text-[13px] text-text-muted">quer compartilhar "Reunião de equipe"</div>
        </div>
        <button className="h-[34px] rounded-sm bg-accent px-3.5 text-[13px] font-semibold text-text-on-accent">
          Aceitar
        </button>
        <button className="h-[34px] rounded-sm border border-border bg-transparent px-3.5 text-[13px] font-medium text-text-secondary">
          Recusar
        </button>
      </div>

      {/* Compartilhando com */}
      <SectionTitle>Compartilhando com</SectionTitle>
      <div className="flex flex-col gap-2">
        {people.map((p) => (
          <div
            key={p.userId}
            className="flex items-center gap-3 rounded-md border border-border bg-bg-elevated px-3.5 py-3"
          >
            <Avatar
              initials={p.initials}
              color={p.color}
              size={38}
              presence={p.online ? 'online' : 'offline'}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-[13px] text-text-muted">
                {p.online ? 'Online agora' : 'Visto há 2 h'}
              </div>
            </div>
            <span
              className="rounded-full bg-bg-elevated-2 px-2.5 py-1 text-xs font-semibold"
              style={{ color: p.perm === 'edit' ? 'var(--accent)' : 'var(--text-secondary)' }}
            >
              {p.perm === 'edit' ? 'Editar' : 'Ver'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
      {children}
    </h3>
  )
}

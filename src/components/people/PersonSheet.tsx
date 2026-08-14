import { useEffect, useState } from 'react'
import type { Perm } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { usePeople, useUpdateSharePerm, useRemovePerson } from '@/hooks/usePeople'
import { useReminders } from '@/hooks/useReminders'
import { personIsOnline } from '@/lib/constants'
import { hasSupabase } from '@/services/supabase'
import { Avatar } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

export function PersonSheet() {
  const personId = useAppStore((s) => s.selectedPersonId)
  const close = useAppStore((s) => s.closePerson)
  const showToast = useAppStore((s) => s.showToast)
  const { data: people = [] } = usePeople()
  const { data: reminders = [] } = useReminders()
  const onlineIds = useAppStore((s) => s.onlineIds)
  const updateSharePerm = useUpdateSharePerm()
  const removePerson = useRemovePerson()

  const [confirmRemove, setConfirmRemove] = useState(false)
  useEffect(() => setConfirmRemove(false), [personId])

  const person = people.find((p) => p.userId === personId)

  // O painel fecha sozinho se a pessoa deixar de existir (ex.: removida).
  useEffect(() => {
    if (personId && !person) close()
  }, [personId, person, close])

  if (!personId || !person) return null

  const shared = reminders.filter((r) => r.shares.some((s) => s.userId === person.userId))
  const online = personIsOnline(person.userId, onlineIds, person.online, hasSupabase)

  const setSharePerm = (noteId: string, current: Perm, perm: Perm) => {
    if (perm === current) return
    updateSharePerm.mutate({ noteId, userId: person.userId, perm })
    showToast(perm === 'edit' ? 'Agora pode editar este lembrete' : 'Agora só vê este lembrete')
  }

  const remove = () => {
    removePerson.mutate(person.userId)
    showToast(`Você parou de compartilhar com ${firstName(person.name)}`)
    close()
  }

  return (
    <Modal title="Perfil" onClose={close}>
      {/* Identidade */}
      <div className="flex flex-col items-center px-5 pb-1 pt-6">
        <Avatar
          initials={person.initials}
          color={person.color}
          size={76}
          presence={online ? 'online' : 'offline'}
          ringColor="var(--bg-surface)"
        />
        <div className="mt-3 text-lg font-bold tracking-[-.01em]">{person.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-text-muted">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: online ? 'var(--success)' : 'var(--text-muted)' }}
          />
          {online ? 'Online agora' : 'Offline'}
        </div>
      </div>

      <div className="flex flex-col gap-[22px] p-5">
        {/* O que está compartilhado — permissão por lembrete */}
        <section>
          <SectionLabel>
            Compartilhado {shared.length > 0 && <span className="text-text-muted">· {shared.length}</span>}
          </SectionLabel>
          {shared.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {shared.map((r) => {
                const current: Perm = r.shares.find((s) => s.userId === person.userId)?.perm ?? 'view'
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-2.5 rounded-md border border-border bg-bg-base px-3 py-2.5"
                  >
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: r.color }} />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{r.title}</span>
                    <SharePermToggle
                      value={current}
                      onChange={(perm) => setSharePerm(r.id, current, perm)}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[13px] text-text-muted">
              Nada compartilhado com {firstName(person.name)} ainda.
            </p>
          )}
        </section>

        {/* Remover */}
        <section>
          {confirmRemove ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#ef444480] bg-[#ef44441a] p-2.5">
              <span className="flex-1 px-1 text-[13px] font-medium text-danger">
                Parar de compartilhar com {firstName(person.name)}?
              </span>
              <button
                onClick={() => setConfirmRemove(false)}
                className="h-9 rounded-md border border-border bg-bg-elevated px-3 text-[13px] font-medium text-text-secondary hover:border-border-strong"
              >
                Cancelar
              </button>
              <button
                onClick={remove}
                className="h-9 rounded-md bg-danger px-3 text-[13px] font-semibold text-white"
              >
                Remover
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg-base text-sm font-semibold text-danger transition-colors hover:border-danger hover:bg-[#ef44441a]"
            >
              <Icon name="trash-2" size={16} />
              Parar de compartilhar
            </button>
          )}
        </section>
      </div>
    </Modal>
  )
}

/** Segmentado compacto Ver/Editar para a permissão de um único lembrete. */
function SharePermToggle({ value, onChange }: { value: Perm; onChange: (perm: Perm) => void }) {
  const opts: { key: Perm; label: string }[] = [
    { key: 'view', label: 'Ver' },
    { key: 'edit', label: 'Editar' },
  ]
  return (
    <div className="flex flex-none items-center rounded-md border border-border bg-bg-elevated p-0.5">
      {opts.map((o) => {
        const on = value === o.key
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            aria-pressed={on}
            className={`rounded-[5px] px-2.5 py-1 text-xs font-semibold transition-colors ${
              on ? 'bg-accent text-text-on-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
      {children}
    </div>
  )
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name
}

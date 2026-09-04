import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { useCreateWorkspace, useWorkspaces } from '@/hooks/useWorkspaces'
import { CARD_COLORS } from '@/lib/constants'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { WorkspaceSheet } from './WorkspaceSheet'

/** Barra de quadros: "Pessoal" + cada workspace; troca o escopo do mural e gerencia o quadro. */
export function WorkspaceSwitcher() {
  const { data: workspaces = [] } = useWorkspaces()
  const active = useAppStore((s) => s.activeWorkspaceId)
  const setActive = useAppStore((s) => s.setActiveWorkspace)

  const [manageId, setManageId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="mb-5 flex flex-wrap items-center gap-1.5">
      <Chip label="Pessoal" icon="bell" on={active === null} onClick={() => setActive(null)} />

      {workspaces.map((w) => {
        const on = active === w.id
        return (
          <div key={w.id} className="flex items-center">
            <button
              onClick={() => setActive(w.id)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border py-0 text-[13.5px] transition-colors ${
                on
                  ? 'border-accent bg-accent-surface font-semibold text-accent-ink'
                  : 'border-border bg-bg-elevated font-medium text-text-secondary hover:border-border-strong'
              } ${on ? 'rounded-r-none pl-3.5 pr-2' : 'px-3.5'}`}
            >
              <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: w.color }} />
              {w.name}
              <span className="text-xs font-semibold text-text-muted">{w.memberCount}</span>
            </button>
            {on && (
              <button
                onClick={() => setManageId(w.id)}
                title="Gerenciar quadro"
                aria-label="Gerenciar quadro"
                className="grid h-9 w-8 flex-none place-items-center rounded-r-full border border-l-0 border-accent bg-accent-surface text-accent-ink transition-colors hover:bg-accent-surface"
              >
                <Icon name="settings" size={14} />
              </button>
            )}
          </div>
        )
      })}

      <button
        onClick={() => setCreating(true)}
        title="Novo quadro"
        className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-border px-3 text-[13px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
      >
        <Icon name="plus" size={14} /> Quadro
      </button>

      {manageId && <WorkspaceSheet id={manageId} onClose={() => setManageId(null)} />}
      {creating && (
        <CreateWorkspaceModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setActive(id)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}

function Chip({
  label,
  icon,
  on,
  onClick,
}: {
  label: string
  icon: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] transition-colors ${
        on
          ? 'border-accent bg-accent-surface font-semibold text-accent-ink'
          : 'border-border bg-bg-elevated font-medium text-text-secondary hover:border-border-strong'
      }`}
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  )
}

function CreateWorkspaceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const create = useCreateWorkspace()
  const showToast = useAppStore((s) => s.showToast)
  const [name, setName] = useState('')
  const [color, setColor] = useState('#FACC15')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    try {
      const ws = await create.mutateAsync({ name: name.trim() || 'Quadro', color })
      showToast('Quadro criado')
      onCreated(ws.id)
    } catch {
      setError('Não foi possível criar. Verifique a conexão e tente de novo.')
    }
  }

  return (
    <Modal
      title="Novo quadro"
      onClose={onClose}
      footer={
        <>
          {error && (
            <span className="flex-1 truncate text-[13px] font-medium text-danger">{error}</span>
          )}
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
            Criar
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-[18px] p-5">
        <div>
          <div className="mb-2 text-[13px] font-medium text-text-secondary">Nome</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            autoFocus
            maxLength={40}
            placeholder="Ex.: Casa, Trabalho, Time de design…"
            className="h-[42px] w-full rounded-md border border-border bg-bg-base px-3 text-sm text-text-primary outline-none focus:border-border-strong"
          />
        </div>
        <div>
          <div className="mb-2 text-[13px] font-medium text-text-secondary">Cor</div>
          <div className="flex flex-wrap gap-2.5">
            {CARD_COLORS.map((c) => {
              const on = color === c.hex
              return (
                <button
                  key={c.hex}
                  title={c.name}
                  onClick={() => setColor(c.hex)}
                  className="h-[34px] w-[34px] rounded-full transition-transform hover:scale-105"
                  style={{
                    background: c.hex,
                    border: `2px solid ${on ? 'var(--text-primary)' : 'transparent'}`,
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { CARD_COLORS, initialsFromName } from '@/lib/constants'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

export function ProfileSheet() {
  const open = useAppStore((s) => s.profileOpen)
  const profile = useAppStore((s) => s.profile)
  const setProfile = useAppStore((s) => s.setProfile)
  const close = useAppStore((s) => s.closeProfile)
  const showToast = useAppStore((s) => s.showToast)

  const [name, setName] = useState(profile.name)
  const [color, setColor] = useState(profile.color)

  if (!open) return null

  const initials = initialsFromName(name) || '?'
  const dirty =
    (name.trim() !== profile.name || color !== profile.color) && name.trim().length > 0

  const save = () => {
    setProfile({ name: name.trim(), color })
    showToast('Perfil atualizado')
    close()
  }

  return (
    <Modal
      title="Meu perfil"
      onClose={close}
      footer={
        <>
          <div className="flex-1" />
          <button
            onClick={close}
            className="h-[42px] rounded-md border border-border bg-transparent px-[18px] text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={!dirty}
            className="h-[42px] rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center px-5 pb-2 pt-6">
        {/* Avatar ao vivo — reflete iniciais do nome e a cor escolhida. */}
        <motion.span
          key={initials}
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="grid h-[76px] w-[76px] place-items-center rounded-full text-[26px] font-bold text-[#0A0A0B]"
          style={{ background: color, boxShadow: `0 0 0 2px ${color}, 0 0 26px ${color}59` }}
        >
          {initials}
        </motion.span>
        <div className="mt-3.5 text-lg font-bold tracking-[-.01em]">{name.trim() || 'Sem nome'}</div>
      </div>

      <div className="flex flex-col gap-[18px] p-5">
        <div>
          <label htmlFor="profile-name" className="mb-2 block text-[13px] font-medium text-text-secondary">
            Nome de exibição
          </label>
          <input
            id="profile-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && dirty && save()}
            placeholder="Como você aparece para os outros"
            className="h-[42px] w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-border-strong"
          />
          <p className="mt-2 text-[12.5px] text-text-muted">
            As iniciais do avatar são geradas a partir do nome.
          </p>
        </div>

        {/* Cor do avatar */}
        <div>
          <div className="mb-2.5 text-[13px] font-medium text-text-secondary">Cor do avatar</div>
          <div className="flex flex-wrap gap-2.5">
            {CARD_COLORS.map((c) => {
              const on = color === c.hex
              return (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={on}
                  onClick={() => setColor(c.hex)}
                  className="grid h-[34px] w-[34px] place-items-center rounded-full transition-transform hover:scale-105"
                  style={{
                    background: c.hex,
                    border: `2px solid ${on ? 'var(--text-primary)' : 'transparent'}`,
                    boxShadow: on ? `0 0 0 2px ${c.hex}` : 'none',
                  }}
                >
                  {on && <Icon name="check" size={16} style={{ color: '#0A0A0B' }} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}

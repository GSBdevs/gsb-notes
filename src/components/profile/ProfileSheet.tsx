import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/useAppStore'
import { profileService } from '@/services/profileService'
import { hasSupabase } from '@/services/supabase'
import { CARD_COLORS, initialsFromName } from '@/lib/constants'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024 // 5 MB

export function ProfileSheet() {
  const open = useAppStore((s) => s.profileOpen)
  const profile = useAppStore((s) => s.profile)
  const setProfile = useAppStore((s) => s.setProfile)
  const close = useAppStore((s) => s.closeProfile)
  const showToast = useAppStore((s) => s.showToast)

  const [name, setName] = useState(profile.name)
  const [color, setColor] = useState(profile.color)
  const [photo, setPhoto] = useState<string | null>(profile.avatarUrl ?? null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Re-semeia o formulário toda vez que a folha ABRE — senão o estado inicial fica preso no
  // valor do primeiro render (padrão do store), mostrando um perfil antigo/placeholder.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName(profile.name)
      setColor(profile.color)
      setPhoto(profile.avatarUrl ?? null)
    }
    wasOpen.current = open
  }, [open, profile])

  if (!open) return null

  const initials = initialsFromName(name) || '?'
  const dirty =
    (name.trim() !== profile.name || color !== profile.color || (photo ?? null) !== (profile.avatarUrl ?? null)) &&
    name.trim().length > 0

  const pickPhoto = () => fileRef.current?.click()

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permite reescolher o mesmo arquivo
    if (!file) return
    if (!hasSupabase) {
      showToast('Foto de perfil requer o backend configurado.')
      return
    }
    if (!file.type.startsWith('image/')) {
      showToast('Escolha um arquivo de imagem.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast('Imagem muito grande (máx. 5 MB).')
      return
    }
    setUploading(true)
    try {
      const url = await profileService.uploadAvatar(file)
      setPhoto(url)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Não foi possível enviar a foto')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      // Grava no banco (profiles) ANTES do store local — senão o hydrate do próximo login
      // sobrescreve de volta.
      await profileService.update({ name: name.trim(), color, avatarUrl: photo })
      setProfile({ name: name.trim(), color, avatarUrl: photo })
      showToast('Perfil atualizado')
      close()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível salvar o perfil')
    } finally {
      setSaving(false)
    }
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
            disabled={!dirty || saving}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {saving && <Icon name="loader-2" size={16} className="animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      <div className="flex flex-col items-center px-5 pb-2 pt-6">
        {/* Avatar ao vivo — foto (se houver) ou iniciais + cor. Botão de câmera sobreposto. */}
        <div className="relative">
          <motion.span
            key={photo ?? initials}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="grid h-[84px] w-[84px] place-items-center overflow-hidden rounded-full text-[28px] font-bold text-[#0A0A0B]"
            style={{ background: color, boxShadow: `0 0 0 2px ${color}, 0 0 26px ${color}59` }}
          >
            {photo ? (
              <img src={photo} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </motion.span>
          <button
            onClick={pickPhoto}
            disabled={uploading}
            aria-label="Trocar foto"
            title="Trocar foto"
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-bg-surface bg-bg-elevated-2 text-text-primary transition-colors hover:bg-bg-elevated disabled:opacity-60"
          >
            {uploading ? (
              <Icon name="loader-2" size={15} className="animate-spin" />
            ) : (
              <Icon name="camera" size={15} />
            )}
          </button>
        </div>
        <div className="mt-3.5 text-lg font-bold tracking-[-.01em]">{name.trim() || 'Sem nome'}</div>
        {photo && (
          <button
            onClick={() => setPhoto(null)}
            className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-text-muted transition-colors hover:text-danger"
          >
            <Icon name="trash-2" size={12} /> Remover foto
          </button>
        )}
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
            Sem foto, o avatar usa as iniciais do nome na cor escolhida.
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

import { useMemo, useRef, useState } from 'react'
import type { Sticker } from '@/types'
import {
  useAddSticker,
  useCreateStickerPack,
  useDeleteSticker,
  useStickerPacks,
  useStickers,
} from '@/hooks/useStickers'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@/components/ui/Icon'

const ACCEPT = 'image/png,image/webp,image/jpeg,image/gif'
const RECENT_LIMIT = 12

/**
 * Menu secreto de figurinhas (abre com CTRL+SHIFT+F no chat). Estilo WhatsApp: recentes primeiro,
 * depois as salvas (filtráveis por pacote), e opção de adicionar imagens / criar pacote. Cada usuário
 * tem sua própria biblioteca. Ao escolher, envia a figurinha e marca como recente.
 */
export function StickerPicker({ onPick, onClose }: { onPick: (s: Sticker) => void; onClose: () => void }) {
  const { data: stickers = [], isLoading } = useStickers()
  const { data: packs = [] } = useStickerPacks()
  const add = useAddSticker()
  const del = useDeleteSticker()
  const createPack = useCreateStickerPack()
  const showToast = useAppStore((s) => s.showToast)
  const fileRef = useRef<HTMLInputElement>(null)

  const [packFilter, setPackFilter] = useState<string | null>(null) // null = todas
  const [manage, setManage] = useState(false)

  const recents = useMemo(
    () =>
      stickers
        .filter((s) => s.lastUsedAt)
        .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
        .slice(0, RECENT_LIMIT),
    [stickers],
  )
  const saved = useMemo(
    () => (packFilter ? stickers.filter((s) => s.packId === packFilter) : stickers),
    [stickers, packFilter],
  )

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    Array.from(files).forEach((file) =>
      add.mutate(
        { file, packId: packFilter },
        { onError: (e) => showToast(e instanceof Error ? e.message : 'Falha ao adicionar figurinha.') },
      ),
    )
  }

  const onNewPack = async () => {
    const name = window.prompt('Nome do pacote:')
    if (name == null) return
    try {
      const pack = await createPack.mutateAsync(name.trim() || 'Meu pacote')
      setPackFilter(pack.id)
    } catch {
      showToast('Não foi possível criar o pacote.')
    }
  }

  return (
    <div className="flex-none border-t border-border bg-bg-elevated">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon name="sparkles" size={15} style={{ color: 'var(--accent-ink)' }} />
        <span className="text-[13px] font-semibold">Figurinhas</span>
        <div className="flex-1" />
        <button
          onClick={() => setManage((m) => !m)}
          title="Gerenciar"
          className={`grid h-8 w-8 place-items-center rounded-md transition-colors hover:bg-bg-elevated-2 ${
            manage ? 'text-danger' : 'text-text-muted'
          }`}
        >
          <Icon name="trash-2" size={15} />
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          title="Adicionar figurinha"
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-[13px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Icon name={add.isPending ? 'loader-2' : 'plus'} size={14} className={add.isPending ? 'animate-spin' : ''} />
          Adicionar
        </button>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="grid h-8 w-8 place-items-center rounded-md text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-text-primary"
        >
          <Icon name="x" size={16} />
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </div>

      {/* Pacotes */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 pb-2">
        <PackChip label="Todas" on={packFilter === null} onClick={() => setPackFilter(null)} />
        {packs.map((p) => (
          <PackChip key={p.id} label={p.name} on={packFilter === p.id} onClick={() => setPackFilter(p.id)} />
        ))}
        <button
          onClick={onNewPack}
          className="inline-flex h-7 flex-none items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-[12px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <Icon name="plus" size={12} /> Pacote
        </button>
      </div>

      {/* Corpo */}
      <div className="max-h-[220px] overflow-y-auto px-3 pb-3">
        {isLoading ? (
          <p className="py-6 text-center text-[13px] text-text-muted">Carregando…</p>
        ) : stickers.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-muted">
            Você ainda não tem figurinhas. Toque em <span className="font-semibold">Adicionar</span> para subir imagens.
          </p>
        ) : (
          <>
            {recents.length > 0 && packFilter === null && (
              <Section title="Recentes">
                <Grid stickers={recents} manage={manage} onPick={onPick} onDelete={(s) => del.mutate(s)} />
              </Section>
            )}
            <Section title={packFilter ? 'Pacote' : 'Salvas'}>
              {saved.length > 0 ? (
                <Grid stickers={saved} manage={manage} onPick={onPick} onDelete={(s) => del.mutate(s)} />
              ) : (
                <p className="py-3 text-center text-[12.5px] text-text-muted">Nada neste pacote ainda.</p>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-text-muted">{title}</div>
      {children}
    </div>
  )
}

function Grid({
  stickers,
  manage,
  onPick,
  onDelete,
}: {
  stickers: Sticker[]
  manage: boolean
  onPick: (s: Sticker) => void
  onDelete: (s: Sticker) => void
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5">
      {stickers.map((s) => (
        <div key={s.id} className="group relative aspect-square">
          <button
            onClick={() => (manage ? onDelete(s) : onPick(s))}
            className="grid h-full w-full place-items-center rounded-md p-1 transition-colors hover:bg-bg-elevated-2"
          >
            <img src={s.url} alt="figurinha" className="max-h-full max-w-full object-contain" draggable={false} />
          </button>
          {manage && (
            <span className="pointer-events-none absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-danger text-white">
              <Icon name="trash-2" size={11} />
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function PackChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-7 flex-none items-center rounded-full border px-2.5 text-[12px] font-medium transition-colors ${
        on
          ? 'border-accent bg-accent-surface text-accent-ink'
          : 'border-border bg-bg-base text-text-secondary hover:border-border-strong'
      }`}
    >
      {label}
    </button>
  )
}

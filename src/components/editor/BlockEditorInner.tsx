import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import type { PartialBlock } from '@blocknote/core'
import { pt } from '@blocknote/core/locales'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import type { Reminder, Share } from '@/types'
import { useSaveBlock, useDeleteBlock, useSetBlockShares } from '@/hooks/useBlocks'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useAppStore } from '@/store/useAppStore'
import { canEditReminder } from '@/lib/reminders'
import { SharePicker } from '@/components/editor/SharePicker'
import { Icon } from '@/components/ui/Icon'

// UI do editor em pt-BR (dicionário do BlockNote); placeholder do bloco vazio conforme pedido.
const dictionary = {
  ...pt,
  placeholders: {
    ...pt.placeholders,
    default: 'Digite ou aperte / para comandos',
  },
}

/**
 * Editor de um bloco (kind 'block') em tela cheia — BlockNote. Compartilhável, com somente-leitura
 * (lock), excluir e autosave. Carregado sob demanda (chunk lazy). Default export p/ o React.lazy.
 */
export default function BlockEditorInner({ block, onClose }: { block: Reminder; onClose: () => void }) {
  const save = useSaveBlock()
  const del = useDeleteBlock()
  const setShares = useSetBlockShares()
  const qc = useQueryClient()
  const showToast = useAppStore((s) => s.showToast)
  const { data: workspaces = [] } = useWorkspaces()
  const themePref = useAppStore((s) => s.settings.theme)

  const [title, setTitle] = useState(block.title)
  const [shares, setSharesLocal] = useState<Share[]>(block.shares)
  const [sharePanel, setSharePanel] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const isOwner = block.mine
  const locked = !!block.locked
  const canEdit = canEditReminder(block, workspaces) && !locked

  const titleTimer = useRef<ReturnType<typeof setTimeout>>()
  const contentTimer = useRef<ReturnType<typeof setTimeout>>()
  const sharesTimer = useRef<ReturnType<typeof setTimeout>>()

  const editor = useCreateBlockNote({
    dictionary,
    initialContent:
      Array.isArray(block.content) && block.content.length
        ? (block.content as unknown as PartialBlock[])
        : undefined,
  })

  const bnTheme: 'light' | 'dark' =
    themePref === 'light'
      ? 'light'
      : themePref === 'dark'
        ? 'dark'
        : window.matchMedia?.('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'

  const onContentChange = () => {
    if (!canEdit) return
    clearTimeout(contentTimer.current)
    contentTimer.current = setTimeout(() => save.mutate({ id: block.id, patch: { content: editor.document } }), 700)
  }

  const onTitleChange = (v: string) => {
    setTitle(v)
    if (!canEdit) return
    clearTimeout(titleTimer.current)
    titleTimer.current = setTimeout(() => save.mutate({ id: block.id, patch: { title: v } }), 600)
  }

  const onSharesChange = (next: Share[]) => {
    setSharesLocal(next)
    clearTimeout(sharesTimer.current)
    sharesTimer.current = setTimeout(() => setShares.mutate({ id: block.id, shares: next }), 500)
  }

  const toggleLock = () => {
    const next = !locked
    save.mutate(
      { id: block.id, patch: { locked: next } },
      { onSettled: () => qc.invalidateQueries({ queryKey: ['reminders'] }) },
    )
    showToast(next ? 'Bloco em somente-leitura' : 'Bloco liberado para edição')
  }

  const doDelete = () => {
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 3500)
      return
    }
    del.mutate(block.id)
    showToast('Bloco excluído')
    onClose()
  }

  const close = () => {
    clearTimeout(titleTimer.current)
    clearTimeout(contentTimer.current)
    clearTimeout(sharesTimer.current)
    if (canEdit) save.mutate({ id: block.id, patch: { title, content: editor.document } })
    qc.invalidateQueries({ queryKey: ['reminders'] })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg-surface">
      <header className="flex h-14 flex-none items-center gap-2 border-b border-border px-3 md:px-5">
        <button
          onClick={close}
          aria-label="Voltar"
          className="grid h-9 w-9 flex-none place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary"
        >
          <Icon name="chevron-right" size={20} className="rotate-180" />
        </button>
        <div className="flex items-center gap-1.5 text-[13px] font-medium text-text-muted">
          <Icon name={locked ? 'eye' : 'blocks'} size={15} />
          {locked ? 'Somente leitura' : canEdit ? 'Editando' : 'Sem permissão'}
        </div>
        <div className="flex-1" />

        {isOwner && (
          <>
            <button
              onClick={() => setSharePanel((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition-colors ${
                sharePanel || shares.length > 0
                  ? 'border-accent bg-accent-surface text-accent-ink'
                  : 'border-border bg-bg-elevated text-text-secondary hover:border-border-strong hover:text-text-primary'
              }`}
            >
              <Icon name="share-2" size={14} /> Compartilhar
              {shares.length > 0 && <span>· {shares.length}</span>}
            </button>
            <button
              onClick={toggleLock}
              title={locked ? 'Liberar edição' : 'Definir como somente leitura'}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <Icon name={locked ? 'pencil' : 'eye'} size={14} />
              {locked ? 'Liberar' : 'Só leitura'}
            </button>
            <button
              onClick={doDelete}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition-colors ${
                confirmDel
                  ? 'border-danger bg-[#ef44441a] text-danger'
                  : 'border-border bg-bg-elevated text-text-secondary hover:border-danger hover:text-danger'
              }`}
            >
              <Icon name="trash-2" size={14} /> {confirmDel ? 'Confirmar?' : 'Excluir'}
            </button>
          </>
        )}
        <button
          onClick={close}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[13px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
        >
          <Icon name="check" size={14} /> Concluir
        </button>
      </header>

      {isOwner && sharePanel && (
        <div className="flex-none border-b border-border bg-bg-elevated px-4 py-3.5 md:px-6">
          <div className="mx-auto max-w-[820px]">
            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
              <Icon name="share-2" size={14} /> Compartilhar bloco
            </div>
            <SharePicker shares={shares} onChange={onSharesChange} canManage />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[820px] px-4 py-8 md:px-6">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={!canEdit}
            placeholder="Sem título"
            className="mb-4 w-full bg-transparent px-1 text-[32px] font-extrabold tracking-[-.02em] text-text-primary outline-none placeholder:text-text-muted disabled:opacity-80"
          />
          <BlockNoteView editor={editor} editable={canEdit} theme={bnTheme} onChange={onContentChange} />
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { Reminder } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { useReminders, useTogglePin } from '@/hooks/useReminders'
import { useCreateBlock, useDeleteBlock } from '@/hooks/useBlocks'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { GENERAL_SCOPE_ID } from '@/lib/constants'
import { buildGeneralGroups } from '@/lib/generalGroups'
import { AvatarStack } from '@/components/ui/primitives'
import { WorkspaceSwitcher } from '@/components/workspace/WorkspaceSwitcher'
import { GeneralGroupedView, GeneralEmptyKind } from '@/components/workspace/GeneralGroups'
import { Icon } from '@/components/ui/Icon'

/** Extrai um trecho de texto do documento BlockNote (jsonb) para a prévia do card. */
function preview(content?: unknown[] | null): string {
  if (!Array.isArray(content)) return ''
  const out: string[] = []
  for (const blk of content) {
    const inline = (blk as { content?: unknown }).content
    if (Array.isArray(inline)) {
      out.push(
        inline
          .map((n) => (typeof (n as { text?: unknown }).text === 'string' ? (n as { text: string }).text : ''))
          .join(''),
      )
    }
    if (out.join(' ').length > 220) break
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Aba de Blocos (kind 'block'): documentos de anotação em blocos (editor BlockNote). Lista os blocos
 * do usuário; clicar abre o editor. Reusa compartilhamento/realtime das notas.
 */
export function BlocosScreen() {
  const { data: reminders = [], isLoading } = useReminders()
  const { data: workspaces = [] } = useWorkspaces()
  const openBlock = useAppStore((s) => s.openBlock)
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId)
  const create = useCreateBlock()

  // "Geral": visão agregada só-leitura de TODOS os blocos, agrupados por quadro. Senão, o quadro ativo.
  const isGeneral = activeWorkspaceId === GENERAL_SCOPE_ID
  const blocks = reminders
    .filter((r) => r.kind === 'block' && (isGeneral || r.workspaceId === activeWorkspaceId))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
  const generalGroups = isGeneral ? buildGeneralGroups(blocks, workspaces) : []

  // Grade de cards (reutilizada no normal e nos grupos do Geral). No Geral é só leitura e os cards
  // herdam a cor do quadro (colorOverride).
  const renderCards = (items: Reminder[], colorOverride?: string, readOnly = false) => (
    <div className="masonry">
      {items.map((b, i) => (
        <motion.div
          key={b.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: Math.min(i * 0.02, 0.2), ease: [0.16, 1, 0.3, 1] }}
        >
          <BlockCard block={b} colorOverride={colorOverride} readOnly={readOnly} onOpen={() => openBlock(b.id)} />
        </motion.div>
      ))}
    </div>
  )

  return (
    <>
      {/* Seletor de quadro (Geral / Pessoal / workspaces) — mesmo do mural */}
      <WorkspaceSwitcher showGeneral />

      {/* Barra de criar — oculta no Geral (só visualização) */}
      {!isGeneral && (
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3.5 text-[13.5px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {create.isPending ? <Icon name="loader-2" size={15} className="animate-spin" /> : <Icon name="plus" size={15} />}
            Novo bloco
          </button>
          {blocks.length > 0 && (
            <span className="text-[13px] text-text-muted">
              {blocks.length} {blocks.length === 1 ? 'bloco' : 'blocos'}
            </span>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="px-1 py-10 text-sm text-text-muted">Carregando blocos…</p>
      ) : blocks.length === 0 ? (
        isGeneral ? (
          <GeneralEmptyKind
            icon="blocks"
            title="Nenhum bloco nos seus quadros"
            text="O Geral reúne, só para visualização, os blocos de todos os quadros."
          />
        ) : (
        <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
          <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-accent-surface text-accent-ink">
            <Icon name="blocks" size={28} />
          </div>
          <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">Nenhum bloco ainda</h3>
          <p className="mb-5 max-w-[340px] text-sm">
            Crie documentos de anotação em blocos — títulos, listas, to-dos, código. Digite “/” dentro
            do editor para inserir qualquer bloco.
          </p>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-[18px] text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Icon name="plus" size={16} /> Criar bloco
          </button>
        </div>
        )
      ) : isGeneral ? (
        <GeneralGroupedView
          groups={generalGroups}
          renderCards={(items, color) => renderCards(items, color, true)}
        />
      ) : (
        renderCards(blocks)
      )}
    </>
  )
}

function BlockCard({
  block: b,
  colorOverride,
  readOnly = false,
  onOpen,
}: {
  block: Reminder
  /** Cor do quadro (visão Geral) sobrepondo a cor própria do card. */
  colorOverride?: string
  /** Só leitura (visão Geral): oculta as ações inline. */
  readOnly?: boolean
  onOpen: () => void
}) {
  const togglePin = useTogglePin()
  const del = useDeleteBlock()
  const showToast = useAppStore((s) => s.showToast)
  const [confirmDel, setConfirmDel] = useState(false)
  const text = preview(b.content)

  const onDelete = () => {
    if (!confirmDel) {
      setConfirmDel(true)
      setTimeout(() => setConfirmDel(false), 3500)
      return
    }
    del.mutate(b.id)
    showToast('Bloco excluído')
  }

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className="group relative cursor-pointer rounded-lg border border-border bg-bg-elevated p-4 transition-all duration-150 hover:-translate-y-px hover:border-border-strong hover:bg-bg-elevated-2 hover:shadow-pop"
      style={{ borderLeft: `4px solid ${colorOverride ?? b.color}` }}
    >
      {!readOnly && b.mine && (
        <div className="card-actions absolute right-2 top-2 z-[1] flex items-center gap-0.5 rounded-md border border-border bg-bg-elevated-2/95 p-1 shadow-pop backdrop-blur-sm">
          <button
            type="button"
            title={b.pinned ? 'Desafixar' : 'Fixar no topo'}
            aria-label={b.pinned ? 'Desafixar' : 'Fixar'}
            onClick={(e) => {
              e.stopPropagation()
              togglePin.mutate(b)
              showToast(b.pinned ? 'Desafixado' : 'Fixado no topo')
            }}
            className={`grid h-7 w-7 place-items-center rounded transition-colors hover:bg-bg-elevated ${
              b.pinned ? 'text-accent-ink' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon name="pin" size={15} />
          </button>
          <button
            type="button"
            title={confirmDel ? 'Confirmar exclusão' : 'Excluir'}
            aria-label="Excluir"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className={`grid h-7 w-7 place-items-center rounded transition-colors ${
              confirmDel ? 'text-danger' : 'text-text-secondary hover:bg-bg-elevated hover:text-danger'
            }`}
          >
            <Icon name={confirmDel ? 'check' : 'trash-2'} size={15} />
          </button>
        </div>
      )}

      <div className="mb-1.5 flex items-start gap-2">
        <Icon name="blocks" size={15} className="mt-0.5 flex-none text-text-muted" />
        <h3 className="flex-1 text-[15px] font-semibold leading-tight tracking-[-.01em]">{b.title}</h3>
        {b.pinned && <Icon name="pin" size={15} style={{ color: 'var(--accent)', transform: 'rotate(35deg)' }} />}
      </div>
      {text ? (
        <p className="mb-2 text-[13.5px] leading-normal text-text-secondary line-clamp-4">{text}</p>
      ) : (
        <p className="mb-2 text-[13px] italic text-text-muted">Bloco vazio</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {b.locked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-bg-elevated-2 px-2 py-0.5 text-[11px] font-semibold text-text-muted">
            <Icon name="eye" size={11} /> Só leitura
          </span>
        )}
        {!b.mine && <span className="text-[11px] font-semibold text-text-muted">por {b.ownerName.split(' ')[0]}</span>}
        {b.shares.length > 0 && (
          <>
            <div className="flex-1" />
            <AvatarStack shares={b.shares} />
          </>
        )}
      </div>
    </div>
  )
}

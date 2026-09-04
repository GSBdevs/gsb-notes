import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'
import { useAppStore } from '@/store/useAppStore'
import type { Share } from '@/types'

const REMINDERS = ['reminders'] as const

/** Cria um bloco vazio (no quadro ativo) e já abre o editor em cima dele. */
export function useCreateBlock() {
  const qc = useQueryClient()
  const openBlock = useAppStore((s) => s.openBlock)
  const activeWorkspaceId = useAppStore((s) => s.activeWorkspaceId)
  return useMutation({
    mutationFn: () => notesService.createBlock(activeWorkspaceId),
    onSuccess: (block) => {
      qc.invalidateQueries({ queryKey: REMINDERS })
      openBlock(block.id)
    },
  })
}

/** Autosave do editor de blocos (título/conteúdo/lock). Não invalida a lista — o editor cuida ao fechar. */
export function useSaveBlock() {
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { title?: string; content?: unknown; locked?: boolean; workspaceId?: string | null } }) =>
      notesService.saveBlock(id, patch),
  })
}

/** Exclui um bloco (só o dono). */
export function useDeleteBlock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notesService.deleteNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: REMINDERS }),
  })
}

/** Alinha os compartilhamentos de um bloco (só o dono). */
export function useSetBlockShares() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, shares }: { id: string; shares: Share[] }) => notesService.setNoteShares(id, shares),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: REMINDERS })
      qc.invalidateQueries({ queryKey: ['people'] })
    },
  })
}

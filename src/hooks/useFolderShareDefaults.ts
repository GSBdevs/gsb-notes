import { useEffect, useMemo, useRef, useState } from 'react'
import type { Perm, Share } from '@/types'
import { useWorkspaceMembers } from '@/hooks/useWorkspaces'

/**
 * Defaults de compartilhamento numa PASTA (organização pessoal, compartilhamento POR ITEM).
 * - Ao abrir uma nota NOVA numa pasta, ou ao TROCAR de pasta no editor, pré-seleciona as pessoas da
 *   pasta (editável depois). Nota EXISTENTE mantém o que foi salvo.
 * - `personal` é o atalho "só para mim": marcado = shares vazio + esconde o seletor; desmarcado =
 *   escolhe quem recebe (seletor aparece, por padrão com as pessoas da pasta). É estado EXPLÍCITO —
 *   desmarcar todos no seletor NÃO vira "Pessoal" sozinho (dá pra adicionar gente de fora numa pasta
 *   sem membros). Fora de pasta, `hasFolder` é false e o atalho some.
 *
 * `setShares` é o setter do editor (patch do store, ou o onChange local do bloco).
 */
export function useFolderShareDefaults({
  open,
  mode,
  workspaceId,
  shares,
  setShares,
}: {
  open: boolean
  mode: 'new' | 'edit'
  workspaceId: string | null
  shares: Share[]
  setShares: (shares: Share[]) => void
}) {
  const { data: members = [] } = useWorkspaceMembers(workspaceId)
  const folderPeople = useMemo<Share[]>(
    () =>
      members
        .filter((m) => !m.isOwner)
        .map((m) => ({
          userId: m.userId,
          name: m.name,
          initials: m.initials,
          color: m.color,
          avatarUrl: m.avatarUrl ?? null,
          perm: (m.role === 'viewer' ? 'view' : 'edit') as Perm,
        })),
    [members],
  )

  const [personal, setPersonalState] = useState(false)
  // Aplica defaults por abertura e por troca de pasta (não re-roda a cada render). Reseta ao fechar.
  const syncedWs = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (!open) {
      syncedWs.current = undefined
      return
    }
    if (syncedWs.current === workspaceId) return
    if (workspaceId && members.length === 0) return // aguarda os membros da pasta carregarem
    const firstRun = syncedWs.current === undefined
    syncedWs.current = workspaceId
    if (!workspaceId) {
      setPersonalState(false) // fora de pasta não tem "Pessoal"
      return
    }
    if (firstRun && mode === 'edit') {
      // Nota existente: respeita o que foi salvo (vazio = estava como Pessoal).
      setPersonalState(shares.length === 0)
    } else {
      // Nota nova, ou troca de pasta: default = pessoas da pasta.
      setPersonalState(false)
      setShares(folderPeople)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId, members])

  const setPersonal = (v: boolean) => {
    setPersonalState(v)
    setShares(v ? [] : folderPeople)
  }

  return { folderPeople, personal, setPersonal, hasFolder: !!workspaceId }
}

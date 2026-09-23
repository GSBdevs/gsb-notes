import type { Reminder, Workspace } from '@/types'

/**
 * Um grupo do quadro "Geral" (visão agregada só-leitura): por quadro (com `workspace`) ou por
 * origem (com `label`/`icon`). Serve para lembretes, tarefas e blocos — todos são `Reminder`.
 */
export interface GeneralGroup {
  key: string
  label?: string
  icon?: string
  workspace?: Workspace
  items: Reminder[]
}

/**
 * Monta os grupos do Geral na ordem pedida: (1) Pessoais (meus, sem compartilhamento, sem quadro)
 * → (2) Compartilhados sem quadro (com shares OU recebidos) → (3) um grupo por quadro (na ordem da
 * lista de quadros). Grupos vazios são omitidos. `list` já deve vir ordenada (fixados primeiro),
 * então a ordem se mantém dentro de cada grupo.
 */
export function buildGeneralGroups(list: Reminder[], workspaces: Workspace[]): GeneralGroup[] {
  const groups: GeneralGroup[] = []
  const personal = list.filter((r) => r.workspaceId === null && r.mine && r.shares.length === 0)
  const shared = list.filter((r) => r.workspaceId === null && !(r.mine && r.shares.length === 0))
  if (personal.length) groups.push({ key: 'personal', label: 'Pessoais', icon: 'bell', items: personal })
  if (shared.length) groups.push({ key: 'shared', label: 'Compartilhados', icon: 'share-2', items: shared })

  const known = new Set<string>()
  for (const w of workspaces) {
    known.add(w.id)
    const items = list.filter((r) => r.workspaceId === w.id)
    if (items.length) groups.push({ key: w.id, workspace: w, items })
  }
  // Itens num quadro que eu não carrego (ex.: acesso perdido) — mantêm a cor própria.
  const orphans = list.filter((r) => r.workspaceId !== null && !known.has(r.workspaceId))
  if (orphans.length) groups.push({ key: 'orphans', label: 'Outros quadros', icon: 'layers', items: orphans })
  return groups
}

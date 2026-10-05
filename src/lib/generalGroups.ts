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
 * Monta os grupos do Geral na ordem pedida: (1) Compartilhados → (2) Pessoais (meus, privados) →
 * (3) um grupo por PASTA minha (na ordem da lista de pastas). Grupos vazios são omitidos. `list`
 * já deve vir ordenada (fixados primeiro), então a ordem se mantém dentro de cada grupo.
 *
 * "Pastas" são pessoais do dono: só os itens das MINHAS pastas viram faixa de pasta. Um item que
 * carrega o `workspaceId` de uma pasta que não é minha (ex.: recebi ele compartilhado) conta como
 * "Compartilhado" — a pasta do outro não aparece para mim.
 */
export function buildGeneralGroups(list: Reminder[], workspaces: Workspace[]): GeneralGroup[] {
  const groups: GeneralGroup[] = []
  const known = new Set(workspaces.map((w) => w.id))
  const inMyFolder = (r: Reminder) => r.workspaceId !== null && known.has(r.workspaceId)

  const shared = list.filter((r) => !inMyFolder(r) && !(r.mine && r.shares.length === 0))
  const personal = list.filter((r) => !inMyFolder(r) && r.mine && r.shares.length === 0)
  if (shared.length) groups.push({ key: 'shared', label: 'Compartilhados', icon: 'share-2', items: shared })
  if (personal.length) groups.push({ key: 'personal', label: 'Pessoais', icon: 'bell', items: personal })

  for (const w of workspaces) {
    const items = list.filter((r) => r.workspaceId === w.id)
    if (items.length) groups.push({ key: w.id, workspace: w, items })
  }
  return groups
}

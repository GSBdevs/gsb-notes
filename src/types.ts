/** Modelo de domínio do SB Notas (espelha docs/03-arquitetura-escopo.md §6). */

export type Priority = 'normal' | 'important' | 'urgent'
export type Status = 'active' | 'scheduled' | 'archived'
export type Perm = 'view' | 'edit'
export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly'
/** Tipo da nota: lembrete do mural (disparo), tarefa (checklist) ou bloco de anotação (editor rico). */
export type NoteKind = 'reminder' | 'doc' | 'block'

/**
 * Item de checklist de uma tarefa (kind 'doc'). Persistido em `note_checklist_items` (0016).
 * O `id` é ausente só em itens de rascunho ainda não salvos (criação de tarefa nova).
 */
export interface ChecklistItem {
  id?: string
  text: string
  done: boolean
  /** Quem concluiu o item e quando (vem preenchido do banco; só o dono exibe na UI). */
  doneById?: string | null
  doneByName?: string | null
  doneByColor?: string | null
  doneAt?: string | null
}

/** Compartilhamento de um lembrete com uma pessoa. */
export interface Share {
  userId: string
  initials: string
  name: string
  color: string
  /** Foto de perfil (null = usa iniciais + cor). */
  avatarUrl?: string | null
  perm: Perm
}

/** Recibo de leitura: um destinatário viu o lembrete (o disparo apareceu na tela dele). */
export interface ReadReceipt {
  userId: string
  /** Momento em que viu, em ISO. */
  seenAt: string
}

/** Comentário num lembrete (colaboração — Fase 4). */
export interface Comment {
  id: string
  noteId: string
  authorId: string
  authorName: string
  authorInitials: string
  authorColor: string
  authorAvatar?: string | null
  body: string
  /** ISO da criação. */
  createdAt: string
  /** Fui eu que escrevi? (para permitir apagar.) */
  mine: boolean
}

/** Anexo de um lembrete (arquivo no Storage — Fase 4). */
export interface Attachment {
  id: string
  noteId: string
  name: string
  size: number
  mime: string
  /** URL para baixar/pré-visualizar (assinada no Supabase; objectURL no mock). */
  url: string
  uploaderId: string
  createdAt: string
  /** Fui eu que enviei? (para permitir apagar.) */
  mine: boolean
}

/** Papel de um membro num quadro (RBAC — hierarquia de usuários, migração 0019). */
export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

/** Quadro compartilhado (workspace): contêiner de lembretes visível a todos os membros. */
export interface Workspace {
  id: string
  name: string
  color: string
  ownerId: string
  /** Sou o dono? (só o dono renomeia, gerencia papéis e exclui.) */
  mine: boolean
  /** Total de membros, incluindo o dono. */
  memberCount: number
  /** Meu papel neste quadro (null = não sou membro). */
  myRole: WorkspaceRole | null
}

/** Membro de um quadro, com seu papel. */
export interface WorkspaceMember {
  userId: string
  name: string
  initials: string
  color: string
  avatarUrl?: string | null
  isOwner: boolean
  role: WorkspaceRole
}

export interface Reminder {
  id: string
  title: string
  body: string
  color: string // uma das CARD_COLORS
  priority: Priority
  pinned: boolean
  /** Momento do disparo em ISO (null = sem alarme). Fonte da verdade do agendamento. */
  remindAt: string | null
  /** Rótulo já formatado a partir de `remindAt` (ex.: "Hoje, 14:30"). Derivado. */
  time: string
  recurrence: Recurrence
  status: Status
  shares: Share[]
  /** Etiquetas de texto livre (organização/filtro). */
  tags: string[]
  /** Sou o dono? (destinatários só recebem; recibos "visto por" só valem para o dono.) */
  mine: boolean
  /** Recibos de leitura dos destinatários (só preenchido para o dono; senão, vazio). */
  reads: ReadReceipt[]
  /** Quadro a que pertence (null = lembrete pessoal, fora de qualquer quadro). */
  workspaceId: string | null
  /** Quem criou (para "Criado por" quando o lembrete não é meu). */
  ownerId: string
  ownerName: string
  ownerColor: string
  ownerAvatar?: string | null
  /** MINHA permissão de share 1:1 nesta nota (null = sem share; dono não precisa). */
  myShare: Perm | null
  /** Lembrete do mural, tarefa ou bloco de anotação. */
  kind: NoteKind
  /** Checklist (só faz sentido em kind 'doc'; vazio nos lembretes). */
  checklist: ChecklistItem[]
  /** Documento do editor de blocos (BlockNote) — só em kind 'block'. jsonb no banco. */
  content?: unknown[] | null
  /** Bloco travado como somente-leitura (guardado em style.locked). Só o dono destrava. */
  locked?: boolean
}

/** Rascunho manipulado pelo editor antes de virar Reminder. */
export interface ReminderDraft {
  mode: 'new' | 'edit'
  id: string | null
  title: string
  body: string
  color: string
  priority: Priority
  pinned: boolean
  /** ISO do disparo (null = sem alarme). */
  remindAt: string | null
  recurrence: Recurrence
  shares: Share[]
  tags: string[]
  /** Quadro em que o lembrete será criado/editado (null = pessoal). */
  workspaceId: string | null
  /** Lembrete ou documento de tarefas. */
  kind: NoteKind
  checklist: ChecklistItem[]
  /** Sou o dono do que estou editando? (não-donos não gerenciam shares/quadro). */
  ownedByMe: boolean
}

export interface Person {
  userId: string
  initials: string
  name: string
  color: string
  avatarUrl?: string | null
  perm: Perm
  online: boolean
  /** É só um contato (adicionado por e-mail), ainda sem lembretes compartilhados. */
  isContact?: boolean
}

/** Tipo de notificação (espelha `notifications.type` da migração 0014). */
export type NotificationType =
  | 'note_shared'
  | 'note_created'
  | 'note_edited'
  | 'task_completed'
  | 'checklist_item_done'
  | 'contact_invite'
  | 'contact_accepted'

/** Notificação recebida pelo usuário (sino da topbar). */
export interface AppNotification {
  id: string
  type: NotificationType
  /** Quem causou a ação (null = sistema). */
  actorId: string | null
  actorName: string
  actorInitials: string
  actorColor: string
  actorAvatar?: string | null
  /** Nota relacionada (null nas de contato). */
  noteId: string | null
  /** Título da nota no momento do evento. */
  title: string
  /** Frase pronta ("editou o lembrete", "quer te adicionar…"). */
  body: string
  data: Record<string, unknown>
  read: boolean
  createdAt: string
}

/** Convite de contato pendente (aba Pessoas). `direction` diz se eu enviei ou recebi. */
export interface ContactInvite {
  id: string
  direction: 'incoming' | 'outgoing'
  status: 'pending' | 'accepted' | 'declined'
  /** A outra pessoa do convite (quem me convidou, ou quem eu convidei). */
  userId: string
  name: string
  initials: string
  color: string
  createdAt: string
}

/** Resultado de enviar um convite de contato — a UI escolhe a mensagem certa. */
export type InviteOutcome =
  | 'sent'
  | 'accepted'
  | 'already-pending'
  | 'already-contact'
  | 'not-found'

export interface Settings {
  alarm: boolean
  ontop: boolean
  sound: boolean
  presence: boolean
  reduce: boolean
  /** Iniciar com o SO (só desktop/Tauri). Fonte da verdade é o próprio SO. */
  autostart: boolean
  /** Notificações push (Web Push) para o app fechado. Fonte da verdade é a inscrição no navegador. */
  push: boolean
  /** Cor de destaque do tema (hex de CARD_COLORS). */
  accent: string
  /** Escala da interface (zoom): 1 = padrão. Ajusta o tamanho de tudo no app. */
  scale: number
  /** Tema da interface: escuro (padrão), claro, ou seguir o sistema. */
  theme: 'dark' | 'light' | 'system'
}

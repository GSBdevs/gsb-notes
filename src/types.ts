/** Modelo de domínio do SB Notas (espelha docs/03-arquitetura-escopo.md §6). */

export type Priority = 'normal' | 'important' | 'urgent'
export type Status = 'active' | 'scheduled' | 'archived'
export type Perm = 'view' | 'edit'
export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly'

/**
 * Regra de recorrência avançada (#3). Camada opcional sobre `Recurrence` (que continua sendo a
 * frequência base p/ compatibilidade). Ausente/null = recorrência simples (a cada 1). Guardada
 * em `notes.style.recur` (jsonb — sem migração).
 */
export interface RecurrenceRule {
  /** Frequência base (nunca 'once' — sem recorrência = sem regra). */
  freq: 'daily' | 'weekly' | 'monthly'
  /** "A cada N" (>= 1). */
  interval: number
  /** Só weekly: dias da semana (0=dom … 6=sáb). Vazio = o dia do próprio disparo. */
  weekdays?: number[]
  /** Só monthly: 'day' = no dia X do mês; 'nth' = na N-ésima ocorrência de um dia da semana. */
  monthly?: 'day' | 'nth'
  /** Só monthly 'nth': ordinal (1..4, ou -1 = última). */
  nth?: number
  /** Só monthly 'nth': dia da semana alvo (0..6). */
  weekday?: number
}
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
  /** Responsável pelo item ("quem DEVE" — assignee, #7). Null = sem responsável. Todos veem. */
  assigneeId?: string | null
  assigneeName?: string | null
  assigneeInitials?: string | null
  assigneeColor?: string | null
  assigneeAvatar?: string | null
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

/** Resposta de um destinatário a um disparo (recibo além do "visto"). */
export type ReadResponse = 'done' | 'snoozed'

/** Recibo de leitura: um destinatário viu o lembrete (o disparo apareceu na tela dele). */
export interface ReadReceipt {
  userId: string
  /** Momento em que viu, em ISO. */
  seenAt: string
  /** Resposta ao disparo: concluiu / adiou (null = só viu). Só dono/admins enxergam. */
  response?: ReadResponse | null
  /** Momento da resposta, em ISO. */
  respondedAt?: string | null
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

/** Papel GLOBAL do app (migração 0024). Oculto do usuário comum; só o master vê/atribui. */
export type AppRole = 'master' | 'admin' | 'member'

/** Usuário listado no painel do master (Admin). */
export interface AdminUser {
  userId: string
  name: string
  email: string
  color: string
  avatarUrl?: string | null
  role: AppRole
}

/** Nota de um usuário, vista pelo master no painel (read-only). */
export interface AdminUserNote {
  id: string
  kind: NoteKind
  title: string
  status: Status
  createdAt: string
}

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
  /** Parâmetros avançados da recorrência (null = simples). Ver RecurrenceRule. */
  recurrenceRule?: RecurrenceRule | null
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
  /** Auto-snooze: o disparo re-alerta até concluir/reagendar (guardado em style.snooze). */
  autoSnooze: boolean
  /** Intervalo (min) entre as re-tentativas do auto-snooze. Um de SNOOZE_INTERVALS. */
  snoozeIntervalMin: number
  /** Ordem manual (arrastar-e-mover). Maior = mais no topo. Default: timestamp de criação (mais novo primeiro). Em style.order. */
  order: number
}

/**
 * Proposta de lembrete devolvida pela ferramenta de IA (teste, só master). A IA nunca grava — isto
 * pré-preenche o editor e o usuário confirma. Ver src/services/aiService.ts e a Edge Function
 * `ai-assistant`.
 */
export interface AiReminderProposal {
  title: string
  body: string
  /** ISO do disparo, ou null se o pedido não tinha quando. */
  remindAt: string | null
  priority: Priority
  recurrence: Recurrence
  tags: string[]
}

/** Resultado da busca na web (grounding) da IA: resposta + fontes citadas. */
export interface AiSearchResult {
  answer: string
  sources: { title: string; url: string }[]
}

/** Item compacto enviado à IA (editar/organizar). Inclui `id` para a IA referenciar o alvo. */
export interface AiNoteItem {
  id: string
  kind: 'reminder' | 'doc'
  title: string
  priority: Priority
  /** ISO do disparo, ou null. */
  remindAt: string | null
  recurrence: Recurrence
  /** Progresso da checklist (só tarefas). */
  checklistDone?: number
  checklistTotal?: number
}

/** Mudança proposta pela IA para um lembrete (campos que o editor aplica; ausentes = sem mudança). */
export interface AiReminderPatch {
  title?: string
  remindAt?: string | null
  priority?: Priority
  recurrence?: Recurrence
}

/** Resultado do modo "editar por linguagem": qual item + o que muda. */
export interface AiEditResult {
  /** id do item alvo; '' quando a IA não encontrou correspondência. */
  targetId: string
  patch: AiReminderPatch
  /** O que a IA entendeu (para mostrar/validar). */
  note: string
}

/** Uma ação sugerida no modo "organizar" (aplicável com 1 toque, via confirmação no editor). */
export interface AiOrganizeAction {
  targetId: string
  label: string
  patch: AiReminderPatch
}

/** Resultado do modo "organizar": resumo + ações concretas. */
export interface AiOrganizeResult {
  summary: string
  actions: AiOrganizeAction[]
}

/** Uma mensagem da conversa do modo "criar" (mini-chat). */
export interface AiChatMessage {
  role: 'user' | 'assistant'
  text: string
}

/** Resultado de um turno do chat: resposta + proposta corrente. */
export interface AiChatResult {
  reply: string
  proposal: AiReminderProposal
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
  /** Parâmetros avançados da recorrência (null = simples). */
  recurrenceRule?: RecurrenceRule | null
  shares: Share[]
  tags: string[]
  /** Quadro em que o lembrete será criado/editado (null = pessoal). */
  workspaceId: string | null
  /** Lembrete ou documento de tarefas. */
  kind: NoteKind
  checklist: ChecklistItem[]
  /** Sou o dono do que estou editando? (não-donos não gerenciam shares/quadro). */
  ownedByMe: boolean
  /** Auto-snooze ligado neste lembrete (insiste até concluir/reagendar). */
  autoSnooze: boolean
  /** Intervalo (min) entre as re-tentativas do auto-snooze. */
  snoozeIntervalMin: number
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
  | 'note_comment'
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

/** Referência a uma nota citada/enviada numa mensagem de DM (snapshot p/ exibir o card). */
export interface DmNoteRef {
  /** Id da nota (null se foi apagada — aí só resta o snapshot). */
  noteId: string | null
  kind: NoteKind
  title: string
}

/** Uma mensagem direta (DM) 1:1. Ver migração 0023. */
export interface DmMessage {
  id: string
  conversationId: string
  senderId: string
  /** Fui eu que enviei? */
  mine: boolean
  body: string
  /** Mensagem automática do sistema (ex.: "Você foi adicionado em…"). */
  system: boolean
  /** Id da mensagem respondida (citação estilo WhatsApp); resolvida na UI pela lista carregada. */
  replyToId?: string | null
  /** Card de nota anexado à mensagem (citar/enviar lembrete/tarefa/bloco). */
  noteRef?: DmNoteRef | null
  /** URL pública da figurinha, quando a mensagem é uma figurinha. */
  stickerUrl?: string | null
  createdAt: string
}

/** Figurinha da biblioteca do usuário (migração 0025). */
export interface Sticker {
  id: string
  /** URL pública (bucket 'stickers'). */
  url: string
  /** Caminho no bucket (para enviar na DM). */
  path: string
  packId: string | null
  /** Última vez usada (para a aba "recentes"; null = nunca). */
  lastUsedAt: string | null
}

/** Pacote de figurinhas do usuário. */
export interface StickerPack {
  id: string
  name: string
}

/** Uma conversa 1:1 (item do inbox de mensagens). */
export interface DmConversation {
  id: string
  /** A outra pessoa. */
  peerId: string
  peerName: string
  peerInitials: string
  peerColor: string
  peerAvatar?: string | null
  lastMessageAt: string
  /** Prévia curta da última mensagem (texto ou rótulo da nota). */
  lastPreview: string
  /** Nº de mensagens não-lidas por mim. */
  unread: number
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
  /** Padrão do auto-snooze para lembretes novos (insistir até concluir/reagendar). */
  autoSnooze: boolean
  /** Intervalo (min) padrão do auto-snooze em lembretes novos. Um de SNOOZE_INTERVALS. */
  snoozeInterval: number
  /** Som do alarme (Android): URI do toque escolhido no seletor do sistema. null = som padrão. */
  alarmSoundUri: string | null
  /** Nome do som escolhido (para exibir nos Ajustes). */
  alarmSoundName: string
}

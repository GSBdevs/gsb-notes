import type { Attachment, City, Comment, ContactInvite, InviteOutcome, LogisticsBoard, LogisticsUser, NewRouteInput, Perm, Person, ReadResponse, Reminder, ReminderDraft, RouteMeta, RouteSlot, ServiceCall, Share, Workspace, WorkspaceMember, WorkspaceRole } from '@/types'
import { SEED_PEOPLE, SEED_REMINDERS } from '@/data/mock'
import { deriveStatus, formatRemindAt } from '@/lib/reminders'
import { initialsFromName } from '@/lib/constants'
import { hasSupabase } from './supabase'
import { SupabaseNotesService } from './supabaseNotesService'

/**
 * Contrato de dados do SB Notas. A UI só conhece esta interface — nunca o Supabase direto.
 * Trocar de backend = trocar a implementação exportada em `notesService`, sem tocar em telas.
 */
export interface NotesService {
  listReminders(): Promise<Reminder[]>
  createReminder(draft: ReminderDraft): Promise<Reminder>
  updateReminder(id: string, draft: ReminderDraft): Promise<Reminder>
  setStatus(id: string, status: Reminder['status']): Promise<void>
  /** Reagenda (ou limpa, com null) o disparo — usado por snooze e recorrência. */
  setRemindAt(id: string, iso: string | null): Promise<void>
  /** Define a ordem manual da nota (arrastar-e-mover). Guardada em style.order. */
  setNoteOrder(id: string, order: number): Promise<void>
  /** Marca que EU vi este lembrete (recibo "visto por"). Best-effort; só faz sentido em nota alheia. */
  markSeen(id: string): Promise<void>
  /** Marca a MINHA resposta ao disparo (concluí/adiei). Best-effort; só em nota alheia. */
  markResponse(id: string, response: ReadResponse): Promise<void>
  listPeople(): Promise<Person[]>
  /** Muda a permissão de uma pessoa em TODOS os lembretes compartilhados com ela (ação em massa). */
  updatePersonPerm(userId: string, perm: Perm): Promise<void>
  /** Muda a permissão de UMA pessoa em UM lembrete específico (controle por-nota). */
  updateSharePerm(noteId: string, userId: string, perm: Perm): Promise<void>
  removePerson(userId: string): Promise<void>
  /** Busca uma pessoa pelo e-mail exato (para compartilhar). Null se não achar. */
  findPersonByEmail(email: string): Promise<Share | null>

  // ── Convites de contato (0015) ──
  /** Convites pendentes que eu enviei ou recebi. */
  listContactInvites(): Promise<ContactInvite[]>
  /** Envia um convite por e-mail. Se já existir um convite reverso pendente, aceita-o. */
  sendContactInvite(email: string): Promise<InviteOutcome>
  /** Aceita (cria contato bidirecional) ou recusa um convite recebido. */
  respondContactInvite(id: string, accept: boolean): Promise<void>

  // ── Checklist de tarefas (kind 'doc') — itens em tabela própria (0016) ──
  /** Adiciona um item ao fim da checklist (só quem edita). */
  addChecklistItem(noteId: string, text: string): Promise<void>
  /** Renomeia um item (só quem edita). */
  renameChecklistItem(itemId: string, text: string): Promise<void>
  /** Remove um item (só quem edita). */
  removeChecklistItem(itemId: string): Promise<void>
  /**
   * Resolve (feito, ou não feito com `failed`) ou reabre um item — liberado a qualquer um que veja a nota.
   * Os dois desfechos contam como resolvido: a tarefa conclui sozinha quando todos estão resolvidos.
   */
  toggleChecklistItem(itemId: string, done: boolean, failed?: boolean): Promise<void>
  /** Atribui (ou limpa, com null) o responsável de um item ("quem deve" — só quem edita). */
  assignChecklistItem(itemId: string, userId: string | null): Promise<void>
  /** Reordena os itens da checklist (arrastar-e-mover): grava a nova posição de cada um. Só quem edita. */
  reorderChecklist(noteId: string, orderedIds: string[]): Promise<void>

  // ── Blocos de anotação (kind 'block') — editor rico BlockNote (0018) ──
  /** Cria um bloco vazio (opcionalmente já num quadro) e o devolve (o editor abre em cima dele). */
  createBlock(workspaceId?: string | null): Promise<Reminder>
  /** Salva título, conteúdo, lock, quadro e/ou cor (autosave do editor de blocos). */
  saveBlock(id: string, patch: { title?: string; content?: unknown; locked?: boolean; workspaceId?: string | null; color?: string }): Promise<void>

  // ── Ações genéricas de nota (usadas nos blocos; RLS restringe ao dono) ──
  /** Exclui a nota (só o dono). */
  deleteNote(id: string): Promise<void>
  /** Alinha os compartilhamentos (shares) de uma nota ao estado desejado (só o dono). */
  setNoteShares(noteId: string, shares: Share[]): Promise<void>

  // ── Quadros compartilhados (workspaces) ──
  listWorkspaces(): Promise<Workspace[]>
  createWorkspace(name: string, color: string): Promise<Workspace>
  updateWorkspace(id: string, patch: { name?: string; color?: string }): Promise<void>
  /** Exclui o quadro (só o dono). Os lembretes voltam a ser pessoais (workspace_id = null). */
  deleteWorkspace(id: string): Promise<void>
  listWorkspaceMembers(id: string): Promise<WorkspaceMember[]>
  /** Adiciona por e-mail exato, com um papel (padrão 'member'). Null se não achar usuário. */
  addWorkspaceMember(id: string, email: string, role?: WorkspaceRole): Promise<WorkspaceMember | null>
  /** Adiciona um contato conhecido (por userId, sem e-mail) — usado no "adicionar rápido". false se já é membro. */
  addWorkspaceMemberByUser(id: string, userId: string, role?: WorkspaceRole): Promise<boolean>
  removeWorkspaceMember(id: string, userId: string): Promise<void>
  /** Muda o papel de um membro (só o dono do quadro). */
  setMemberRole(id: string, userId: string, role: WorkspaceRole): Promise<void>
  /** Sai de um quadro do qual sou membro (não dono). */
  leaveWorkspace(id: string): Promise<void>

  // ── Comentários ──
  listComments(noteId: string): Promise<Comment[]>
  addComment(noteId: string, body: string): Promise<Comment>
  deleteComment(id: string): Promise<void>

  // ── Anexos ──
  listAttachments(noteId: string): Promise<Attachment[]>
  addAttachment(noteId: string, file: File): Promise<Attachment>
  deleteAttachment(id: string): Promise<void>

  // ── Rotas: chamados técnicos (kind 'call') — dados em `service_calls` (0035) ──
  /** Dados de todos os chamados que vejo. Lista SEPARADA de listReminders (só a aba Rotas consulta). */
  listServiceCalls(): Promise<ServiceCall[]>
  /** Cria/atualiza os dados de um chamado (a nota kind 'call' já deve existir). Só quem edita. */
  saveServiceCall(call: ServiceCall): Promise<void>
  /** Reordena uma rota (técnico + dia): route_position = índice de cada chamado em `orderedNoteIds`. */
  reorderRoute(orderedNoteIds: string[]): Promise<void>

  // ── Logística: rotas por cidade (kind 'route') — `logistics_routes` (0038, doc 21) ──
  /** Cidade/vaga/técnico de todas as rotas que vejo. Lista SEPARADA de listReminders. */
  listRoutes(): Promise<RouteMeta[]>
  /** Cria a rota numa vaga livre (nota + logística + itens). Só Master/Admin/Suporte. Devolve o id. */
  createRoute(input: NewRouteInput): Promise<string>
  /** Define (ou limpa) o técnico da rota. Só Master/Admin/Suporte. */
  setRouteTechnician(noteId: string, technicianId: string | null): Promise<void>
  /** Apaga a rota. Só Master/Admin/Suporte. */
  deleteRoute(noteId: string): Promise<void>
  /** Técnicos (todos leem — o nome aparece na rota). */
  listTechnicians(): Promise<LogisticsUser[]>
  /** Todos os usuários + "é técnico" (só gerente recebe dados). */
  listLogisticsUsers(): Promise<LogisticsUser[]>
  /** Liga/desliga "é técnico". Só Master/Admin/Suporte. */
  setTechnician(userId: string, on: boolean): Promise<void>
  /** Cards extras (inclui os excluídos — o nome aparece no histórico). */
  listBoards(): Promise<LogisticsBoard[]>
  /** Cria um card extra (só nome). Só Master/Admin/Suporte. */
  createBoard(name: string): Promise<string>
  /** Exclui (arquiva) o card — só quem criou. Apaga a rota ativa dele; o histórico fica. */
  deleteBoard(id: string): Promise<void>
}

const STORAGE_KEY = 'sb-notas.reminders.v1'
const PEOPLE_KEY = 'sb-notas.people.v1'
const WS_KEY = 'sb-notas.workspaces.v1'
const WS_MEMBERS_KEY = 'sb-notas.workspace-members.v1'
const COMMENTS_KEY = 'sb-notas.comments.v1'
const CALLS_KEY = 'sb-notas.service-calls.v1'
const ROUTES_KEY = 'sb-notas.logistics.v1'
/** Membro "dono" fixo do mock (single-user). */
const MOCK_OWNER: WorkspaceMember = {
  userId: 'me',
  name: 'Você',
  initials: 'VC',
  color: '#FACC15',
  isOwner: true,
  role: 'owner',
}
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `r${Date.now()}`

/**
 * Implementação em memória (Fase 1), espelhada em localStorage para sobreviver a reloads.
 * Simula latência de rede para exercitar os estados de UI. Na Fase 2, dá lugar a uma impl
 * Supabase com a mesma interface (Postgres + Realtime + RLS).
 */
class MockNotesService implements NotesService {
  private reminders: Reminder[] = load()
  private people: Person[] = loadPeople()
  private workspaces: Workspace[] = loadWorkspaces()
  private wsMembers: Record<string, WorkspaceMember[]> = loadWsMembers()
  private comments: Record<string, Comment[]> = loadComments()
  private calls: Record<string, ServiceCall> = loadCalls()
  private logistics: MockLogistics = loadLogistics()
  // Anexos no mock ficam só em memória (o objectURL não sobrevive a reload — é limitação do mock).
  private attachments: Record<string, Attachment[]> = {}

  async listReminders() {
    await delay()
    return this.reminders.map((r) => ({ ...r }))
  }

  async createReminder(draft: ReminderDraft) {
    await delay()
    const reminder: Reminder = {
      id: newId(),
      title: draft.title.trim() || 'Sem título',
      body: draft.body,
      color: draft.color,
      priority: draft.priority,
      pinned: draft.pinned,
      remindAt: draft.remindAt,
      time: formatRemindAt(draft.remindAt),
      recurrence: draft.recurrence,
      recurrenceRule: draft.recurrenceRule ?? null,
      status: deriveStatus('active', draft.remindAt),
      shares: draft.shares,
      tags: draft.tags,
      mine: true,
      reads: [],
      workspaceId: draft.workspaceId,
      ownerId: MOCK_OWNER.userId,
      ownerName: MOCK_OWNER.name,
      ownerColor: MOCK_OWNER.color,
      myShare: null,
      kind: draft.kind,
      checklist: draft.checklist.map((c) => ({ ...c, id: newId() })),
      autoSnooze: draft.autoSnooze,
      snoozeIntervalMin: draft.snoozeIntervalMin,
      order: Date.now(), // mais novo no topo (ordenação desc por order)
    }
    this.reminders = [reminder, ...this.reminders]
    this.persist()
    return { ...reminder }
  }

  async setNoteOrder(id: string, order: number) {
    await delay()
    this.reminders = this.reminders.map((r) => (r.id === id ? { ...r, order } : r))
    this.persist()
  }

  async updateReminder(id: string, draft: ReminderDraft) {
    await delay()
    let updated: Reminder | undefined
    this.reminders = this.reminders.map((r) => {
      if (r.id !== id) return r
      updated = {
        ...r,
        title: draft.title.trim() || 'Sem título',
        body: draft.body,
        color: draft.color,
        priority: draft.priority,
        pinned: draft.pinned,
        remindAt: draft.remindAt,
        time: formatRemindAt(draft.remindAt),
        recurrence: draft.recurrence,
        recurrenceRule: draft.recurrenceRule ?? null,
        status: r.status === 'archived' ? 'archived' : deriveStatus('active', draft.remindAt),
        shares: draft.shares,
        tags: draft.tags,
        workspaceId: draft.workspaceId,
        kind: draft.kind,
        // A checklist é gerenciada ao vivo (itens próprios); o update do editor não a sobrescreve.
        checklist: r.checklist,
        autoSnooze: draft.autoSnooze,
        snoozeIntervalMin: draft.snoozeIntervalMin,
      }
      return updated
    })
    if (!updated) throw new Error(`Lembrete ${id} não encontrado`)
    this.persist()
    return { ...updated }
  }

  async setStatus(id: string, status: Reminder['status']) {
    await delay()
    this.reminders = this.reminders.map((r) => (r.id === id ? { ...r, status } : r))
    if (status === 'archived') this.logisticsCycle(id)
    this.persist()
  }

  async markSeen(_id: string) {
    // Mock é single-user: você é sempre o dono, então não há recibo a registrar. No-op.
  }

  async markResponse(_id: string, _response: ReadResponse) {
    // Mock single-user: sem destinatários para registrar resposta. No-op.
  }

  async setRemindAt(id: string, iso: string | null) {
    await delay()
    this.reminders = this.reminders.map((r) =>
      r.id === id
        ? {
            ...r,
            remindAt: iso,
            time: formatRemindAt(iso),
            status: r.status === 'archived' ? 'archived' : deriveStatus('active', iso),
          }
        : r,
    )
    this.persist()
  }

  async listPeople() {
    await delay()
    return this.people.map((p) => ({ ...p }))
  }

  async findPersonByEmail(email: string): Promise<Share | null> {
    await delay()
    // Mock: casa o local-part do e-mail com o primeiro nome de uma pessoa do seed.
    const local = email.trim().toLowerCase().split('@')[0]
    const p = this.people.find((x) => x.name.toLowerCase().split(' ')[0] === local)
    if (!p) return null
    return { userId: p.userId, name: p.name, initials: p.initials, color: p.color, perm: 'view' }
  }

  // ── Convites de contato (mock single-user: sem par para negociar, entra direto) ──
  async listContactInvites(): Promise<ContactInvite[]> {
    await delay()
    return []
  }

  async sendContactInvite(email: string): Promise<InviteOutcome> {
    await delay()
    const local = email.trim().toLowerCase().split('@')[0]
    if (!local) return 'not-found'
    // Já existe? (no mock, o seed de pessoas faz o papel dos contatos.)
    if (this.people.some((x) => x.name.toLowerCase().split(' ')[0] === local)) return 'already-contact'
    const name = local.charAt(0).toUpperCase() + local.slice(1)
    const colors = ['#60A5FA', '#22C55E', '#F472B6', '#A78BFA', '#F59E0B']
    const person: Person = {
      userId: `c-${local}`,
      name,
      initials: initialsFromName(name),
      color: colors[name.length % colors.length],
      perm: 'view',
      online: false,
      isContact: true,
    }
    this.people = [...this.people, person]
    this.persistPeople()
    return 'accepted'
  }

  async respondContactInvite(_id: string, _accept: boolean) {
    // Mock não tem convites pendentes de verdade — no-op.
  }

  // ── Checklist (itens em memória; parte da própria nota no mock) ──
  async addChecklistItem(noteId: string, text: string) {
    await delay()
    const t = text.trim()
    if (!t) return
    this.reminders = this.reminders.map((r) =>
      r.id === noteId ? { ...r, checklist: [...r.checklist, { id: newId(), text: t, done: false }] } : r,
    )
    this.persist()
  }

  async renameChecklistItem(itemId: string, text: string) {
    await delay()
    this.reminders = this.reminders.map((r) => ({
      ...r,
      checklist: r.checklist.map((c) => (c.id === itemId ? { ...c, text: text.trim() } : c)),
    }))
    this.persist()
  }

  async removeChecklistItem(itemId: string) {
    await delay()
    this.reminders = this.reminders.map((r) => ({
      ...r,
      checklist: r.checklist.filter((c) => c.id !== itemId),
    }))
    this.persist()
  }

  async reorderChecklist(noteId: string, orderedIds: string[]) {
    await delay()
    this.reminders = this.reminders.map((r) => {
      if (r.id !== noteId) return r
      const byId = new Map(r.checklist.map((c) => [c.id, c]))
      const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as typeof r.checklist
      const rest = r.checklist.filter((c) => !c.id || !orderedIds.includes(c.id))
      return { ...r, checklist: [...reordered, ...rest] }
    })
    this.persist()
  }

  // ── Blocos ──
  async createBlock(workspaceId: string | null = null): Promise<Reminder> {
    await delay()
    const reminder: Reminder = {
      id: newId(),
      title: 'Sem título',
      body: '',
      color: '#FACC15',
      priority: 'normal',
      pinned: false,
      remindAt: null,
      time: formatRemindAt(null),
      recurrence: 'once',
      status: 'active',
      shares: [],
      tags: [],
      mine: true,
      reads: [],
      workspaceId,
      ownerId: MOCK_OWNER.userId,
      ownerName: MOCK_OWNER.name,
      ownerColor: MOCK_OWNER.color,
      myShare: null,
      kind: 'block',
      checklist: [],
      content: [],
      locked: false,
      autoSnooze: false,
      snoozeIntervalMin: 10,
      order: Date.now(),
    }
    this.reminders = [reminder, ...this.reminders]
    this.persist()
    return { ...reminder }
  }

  async saveBlock(id: string, patch: { title?: string; content?: unknown; locked?: boolean; workspaceId?: string | null; color?: string }) {
    await delay()
    this.reminders = this.reminders.map((r) =>
      r.id === id
        ? {
            ...r,
            title: patch.title !== undefined ? patch.title.trim() || 'Sem título' : r.title,
            content: patch.content !== undefined ? (patch.content as unknown[]) : r.content,
            locked: patch.locked !== undefined ? patch.locked : r.locked,
            workspaceId: patch.workspaceId !== undefined ? patch.workspaceId : r.workspaceId,
            color: patch.color !== undefined ? patch.color : r.color,
          }
        : r,
    )
    this.persist()
  }

  async deleteNote(id: string) {
    await delay()
    this.reminders = this.reminders.filter((r) => r.id !== id)
    this.persist()
  }

  async setNoteShares(noteId: string, shares: Share[]) {
    await delay()
    this.reminders = this.reminders.map((r) => (r.id === noteId ? { ...r, shares: shares.slice() } : r))
    this.persist()
  }

  async toggleChecklistItem(itemId: string, done: boolean, failed = false) {
    await delay()
    this.reminders = this.reminders.map((r) => {
      if (!r.checklist.some((c) => c.id === itemId)) return r
      const checklist = r.checklist.map((c) =>
        c.id === itemId
          ? {
              ...c,
              done,
              failed: done && failed,
              doneById: done ? MOCK_OWNER.userId : null,
              doneByName: done ? MOCK_OWNER.name : null,
              doneByColor: done ? MOCK_OWNER.color : null,
              doneAt: done ? new Date().toISOString() : null,
            }
          : c,
      )
      const total = checklist.length
      const doneCount = checklist.filter((c) => c.done).length
      let status = r.status
      if (total > 0 && doneCount === total) status = 'archived'
      else if (total > 0 && doneCount < total && r.status === 'archived') status = 'active'
      return { ...r, checklist, status }
    })
    const owner = this.reminders.find((r) => r.checklist.some((c) => c.id === itemId))
    if (owner?.status === 'archived') this.logisticsCycle(owner.id)
    this.persist()
  }

  async assignChecklistItem(itemId: string, userId: string | null) {
    await delay()
    // Resolve o perfil do responsável: "me" = você; senão, um contato conhecido.
    const person =
      userId == null
        ? null
        : userId === MOCK_OWNER.userId
          ? { name: MOCK_OWNER.name, color: MOCK_OWNER.color, avatarUrl: null as string | null }
          : this.people.find((p) => p.userId === userId) ?? null
    this.reminders = this.reminders.map((r) => ({
      ...r,
      checklist: r.checklist.map((c) =>
        c.id === itemId
          ? {
              ...c,
              assigneeId: userId,
              assigneeName: person?.name ?? null,
              assigneeInitials: person ? initialsFromName(person.name) : null,
              assigneeColor: person?.color ?? null,
              assigneeAvatar: person?.avatarUrl ?? null,
            }
          : c,
      ),
    }))
    this.persist()
  }

  async updatePersonPerm(userId: string, perm: Perm) {
    await delay()
    this.people = this.people.map((p) => (p.userId === userId ? { ...p, perm } : p))
    // Reflete nos shares de todos os lembretes (ação em massa).
    this.reminders = this.reminders.map((r) => ({
      ...r,
      shares: r.shares.map((s) => (s.userId === userId ? { ...s, perm } : s)),
    }))
    this.persistPeople()
    this.persist()
  }

  async updateSharePerm(noteId: string, userId: string, perm: Perm) {
    await delay()
    this.reminders = this.reminders.map((r) =>
      r.id === noteId
        ? { ...r, shares: r.shares.map((s) => (s.userId === userId ? { ...s, perm } : s)) }
        : r,
    )
    this.persist()
  }

  async removePerson(userId: string) {
    await delay()
    this.people = this.people.filter((p) => p.userId !== userId)
    this.persistPeople()
  }

  // ── Workspaces ──
  async listWorkspaces() {
    await delay()
    return this.workspaces.map((w) => ({
      ...w,
      memberCount: (this.wsMembers[w.id] ?? []).length,
      myRole: w.mine ? ('owner' as const) : (w.myRole ?? 'member'),
    }))
  }

  async createWorkspace(name: string, color: string) {
    await delay()
    const ws: Workspace = {
      id: newId(),
      name: name.trim() || 'Pasta',
      color,
      ownerId: MOCK_OWNER.userId,
      mine: true,
      memberCount: 1,
      myRole: 'owner',
    }
    this.workspaces = [ws, ...this.workspaces]
    this.wsMembers[ws.id] = [{ ...MOCK_OWNER }]
    this.persistWorkspaces()
    return { ...ws }
  }

  async updateWorkspace(id: string, patch: { name?: string; color?: string }) {
    await delay()
    this.workspaces = this.workspaces.map((w) =>
      w.id === id
        ? { ...w, name: patch.name?.trim() || w.name, color: patch.color ?? w.color }
        : w,
    )
    this.persistWorkspaces()
  }

  async deleteWorkspace(id: string) {
    await delay()
    this.workspaces = this.workspaces.filter((w) => w.id !== id)
    delete this.wsMembers[id]
    // Lembretes do quadro voltam a ser pessoais.
    this.reminders = this.reminders.map((r) => (r.workspaceId === id ? { ...r, workspaceId: null } : r))
    this.persistWorkspaces()
    this.persist()
  }

  async listWorkspaceMembers(id: string) {
    await delay()
    return (this.wsMembers[id] ?? []).map((m) => ({
      ...m,
      role: m.role ?? (m.isOwner ? ('owner' as const) : 'member'),
    }))
  }

  async addWorkspaceMember(id: string, email: string, role: WorkspaceRole = 'member') {
    await delay()
    const local = email.trim().toLowerCase().split('@')[0]
    const p = this.people.find((x) => x.name.toLowerCase().split(' ')[0] === local)
    if (!p) return null
    const list = this.wsMembers[id] ?? []
    if (list.some((m) => m.userId === p.userId)) return null
    const member: WorkspaceMember = {
      userId: p.userId,
      name: p.name,
      initials: p.initials,
      color: p.color,
      avatarUrl: p.avatarUrl ?? null,
      isOwner: false,
      role,
    }
    this.wsMembers[id] = [...list, member]
    this.persistWorkspaces()
    return { ...member }
  }

  async addWorkspaceMemberByUser(id: string, userId: string, role: WorkspaceRole = 'member') {
    await delay()
    const p = this.people.find((x) => x.userId === userId)
    if (!p) return false
    const list = this.wsMembers[id] ?? []
    if (list.some((m) => m.userId === userId)) return false
    this.wsMembers[id] = [
      ...list,
      {
        userId: p.userId,
        name: p.name,
        initials: p.initials,
        color: p.color,
        avatarUrl: p.avatarUrl ?? null,
        isOwner: false,
        role,
      },
    ]
    this.persistWorkspaces()
    return true
  }

  async setMemberRole(id: string, userId: string, role: WorkspaceRole) {
    await delay()
    this.wsMembers[id] = (this.wsMembers[id] ?? []).map((m) =>
      m.userId === userId ? { ...m, role } : m,
    )
    this.persistWorkspaces()
  }

  async removeWorkspaceMember(id: string, userId: string) {
    await delay()
    this.wsMembers[id] = (this.wsMembers[id] ?? []).filter((m) => m.userId !== userId)
    this.persistWorkspaces()
  }

  async leaveWorkspace(id: string) {
    // No mock você é sempre o dono; "sair" some com o quadro da sua lista.
    await this.deleteWorkspace(id)
  }

  // ── Comentários ──
  async listComments(noteId: string) {
    await delay()
    return (this.comments[noteId] ?? []).map((c) => ({ ...c }))
  }

  async addComment(noteId: string, body: string) {
    await delay()
    const comment: Comment = {
      id: newId(),
      noteId,
      authorId: MOCK_OWNER.userId,
      authorName: MOCK_OWNER.name,
      authorInitials: MOCK_OWNER.initials,
      authorColor: MOCK_OWNER.color,
      body: body.trim(),
      createdAt: new Date().toISOString(),
      mine: true,
    }
    this.comments[noteId] = [...(this.comments[noteId] ?? []), comment]
    this.persistComments()
    return { ...comment }
  }

  async deleteComment(id: string) {
    await delay()
    for (const noteId of Object.keys(this.comments)) {
      this.comments[noteId] = this.comments[noteId].filter((c) => c.id !== id)
    }
    this.persistComments()
  }

  // ── Anexos ──
  async listAttachments(noteId: string) {
    await delay()
    return (this.attachments[noteId] ?? []).map((a) => ({ ...a }))
  }

  async addAttachment(noteId: string, file: File) {
    await delay()
    const attachment: Attachment = {
      id: newId(),
      noteId,
      name: file.name,
      size: file.size,
      mime: file.type,
      url: URL.createObjectURL(file), // preview na sessão; some no reload (limitação do mock)
      uploaderId: MOCK_OWNER.userId,
      createdAt: new Date().toISOString(),
      mine: true,
    }
    this.attachments[noteId] = [...(this.attachments[noteId] ?? []), attachment]
    return { ...attachment }
  }

  async deleteAttachment(id: string) {
    await delay()
    for (const noteId of Object.keys(this.attachments)) {
      const found = this.attachments[noteId].find((a) => a.id === id)
      if (found) URL.revokeObjectURL(found.url)
      this.attachments[noteId] = this.attachments[noteId].filter((a) => a.id !== id)
    }
  }

  async listServiceCalls() {
    await delay()
    const alive = new Set(this.reminders.map((r) => r.id))
    return Object.values(this.calls)
      .filter((c) => alive.has(c.noteId))
      .map((c) => ({ ...c }))
  }

  async saveServiceCall(call: ServiceCall) {
    await delay()
    this.calls = { ...this.calls, [call.noteId]: { ...call } }
    this.persistCalls()
  }

  async reorderRoute(orderedNoteIds: string[]) {
    await delay()
    const next = { ...this.calls }
    orderedNoteIds.forEach((id, i) => {
      if (next[id]) next[id] = { ...next[id], routePosition: i }
    })
    this.calls = next
    this.persistCalls()
  }

  // ── Logística (mock: mesmo ciclo do gatilho logistics_day_cycle da 0038) ──
  async listRoutes(): Promise<RouteMeta[]> {
    await delay()
    const alive = new Set(this.reminders.map((r) => r.id))
    const techs = await this.listTechnicians()
    return Object.entries(this.logistics.routes)
      .filter(([id]) => alive.has(id))
      .map(([noteId, m]) => {
        const t = techs.find((x) => x.userId === m.technicianId)
        return {
          noteId,
          city: m.city,
          boardId: m.boardId ?? null,
          slot: m.slot,
          technicianId: m.technicianId,
          technicianName: t?.name ?? null,
          technicianColor: t?.color ?? null,
          technicianAvatar: t?.avatarUrl ?? null,
        }
      })
  }

  async createRoute(input: NewRouteInput): Promise<string> {
    const taken = Object.entries(this.logistics.routes).some(
      ([id, m]) =>
        m.slot === input.slot &&
        (input.boardId ? m.boardId === input.boardId : m.city === input.city) &&
        this.reminders.some((r) => r.id === id),
    )
    if (taken) throw new Error('Já existe uma rota nesta vaga')
    const created = await this.createReminder({
      mode: 'new',
      id: null,
      title: input.title.trim() || 'Rota',
      body: input.body,
      color: '#FACC15',
      priority: 'normal',
      pinned: false,
      remindAt: null,
      recurrence: 'once',
      recurrenceRule: null,
      shares: [],
      tags: [],
      workspaceId: null,
      kind: 'route',
      checklist: input.items.filter((t) => t.trim()).map((text) => ({ text, done: false })),
      ownedByMe: true,
      autoSnooze: false,
      snoozeIntervalMin: 10,
    })
    this.logistics.routes[created.id] = {
      city: input.city,
      boardId: input.boardId,
      slot: input.slot,
      technicianId: input.technicianId,
    }
    this.persistLogistics()
    return created.id
  }

  async setRouteTechnician(noteId: string, technicianId: string | null) {
    await delay()
    const m = this.logistics.routes[noteId]
    if (m) m.technicianId = technicianId
    this.persistLogistics()
  }

  async deleteRoute(noteId: string) {
    await this.deleteNote(noteId)
    delete this.logistics.routes[noteId]
    this.persistLogistics()
  }

  async listTechnicians(): Promise<LogisticsUser[]> {
    return (await this.listLogisticsUsers()).filter((u) => u.isTechnician)
  }

  async listLogisticsUsers(): Promise<LogisticsUser[]> {
    const on = new Set(this.logistics.technicians)
    const users = [
      { userId: MOCK_OWNER.userId, name: MOCK_OWNER.name, color: MOCK_OWNER.color, avatarUrl: null },
      ...this.people.map((p) => ({ userId: p.userId, name: p.name, color: p.color, avatarUrl: p.avatarUrl ?? null })),
    ]
    return users.map((u) => ({ ...u, isTechnician: on.has(u.userId) }))
  }

  async setTechnician(userId: string, on: boolean) {
    await delay()
    const set = new Set(this.logistics.technicians)
    if (on) set.add(userId)
    else set.delete(userId)
    this.logistics.technicians = [...set]
    this.persistLogistics()
  }

  /** Rota do dia concluída → ✗ vão para a Pré-Rota; rota → concluída; Pré-Rota → Rota do dia. */
  private logisticsCycle(noteId: string) {
    const meta = this.logistics.routes[noteId]
    if (!meta || meta.slot !== 'rota') return
    // Card extra: só vai para Concluídos (✗ ficam no histórico), sem Pré-Rota.
    if (meta.boardId || !meta.city) {
      meta.slot = 'concluida'
      this.persistLogistics()
      return
    }
    const city = meta.city
    const route = this.reminders.find((r) => r.id === noteId)
    if (!route) return
    const failed = route.checklist.filter((c) => c.done && c.failed)
    let preId = Object.keys(this.logistics.routes).find(
      (id) => this.logistics.routes[id].city === meta.city && this.logistics.routes[id].slot === 'pre_rota',
    )
    if (failed.length) {
      if (!preId) {
        preId = newId()
        this.reminders = [
          { ...route, id: preId, title: `Pré-Rota — ${CITY_LABEL[city]}`, body: '', status: 'active', checklist: [], completedAt: null, order: Date.now() },
          ...this.reminders,
        ]
        this.logistics.routes[preId] = { city, slot: 'pre_rota', technicianId: null }
      }
      const target = preId
      this.reminders = this.reminders.map((r) =>
        r.id === target
          ? { ...r, checklist: [...r.checklist, ...failed.map((c) => ({ id: newId(), text: c.text, done: false }))] }
          : r,
      )
    }
    meta.slot = 'concluida'
    if (preId) this.logistics.routes[preId].slot = 'rota'
    this.persistLogistics()
  }

  async listBoards(): Promise<LogisticsBoard[]> {
    await delay()
    return (this.logistics.boards ?? []).map((b) => ({ ...b }))
  }

  async createBoard(name: string): Promise<string> {
    await delay()
    const id = newId()
    this.logistics.boards = [
      ...(this.logistics.boards ?? []),
      { id, name: name.trim(), createdBy: MOCK_OWNER.userId, archived: false },
    ]
    this.persistLogistics()
    return id
  }

  async deleteBoard(id: string) {
    await delay()
    for (const [noteId, m] of Object.entries(this.logistics.routes)) {
      if (m.boardId === id && m.slot === 'rota') {
        this.reminders = this.reminders.filter((r) => r.id !== noteId)
        delete this.logistics.routes[noteId]
      }
    }
    this.logistics.boards = (this.logistics.boards ?? []).map((b) => (b.id === id ? { ...b, archived: true } : b))
    this.persist()
    this.persistLogistics()
  }

  private persistLogistics() {
    try {
      localStorage.setItem(ROUTES_KEY, JSON.stringify(this.logistics))
    } catch {
      /* localStorage indisponível: segue só em memória */
    }
  }

  private persistCalls() {
    try {
      localStorage.setItem(CALLS_KEY, JSON.stringify(this.calls))
    } catch {
      /* localStorage indisponível: segue só em memória */
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reminders))
    } catch {
      /* localStorage indisponível: segue só em memória */
    }
  }

  private persistPeople() {
    try {
      localStorage.setItem(PEOPLE_KEY, JSON.stringify(this.people))
    } catch {
      /* localStorage indisponível: segue só em memória */
    }
  }

  private persistWorkspaces() {
    try {
      localStorage.setItem(WS_KEY, JSON.stringify(this.workspaces))
      localStorage.setItem(WS_MEMBERS_KEY, JSON.stringify(this.wsMembers))
    } catch {
      /* localStorage indisponível: segue só em memória */
    }
  }

  private persistComments() {
    try {
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(this.comments))
    } catch {
      /* localStorage indisponível: segue só em memória */
    }
  }
}

function load(): Reminder[] {
  let list: Reminder[]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    list = raw ? (JSON.parse(raw) as Reminder[]) : SEED_REMINDERS.map((r) => ({ ...r }))
  } catch {
    list = SEED_REMINDERS.map((r) => ({ ...r }))
  }
  // Garante id em todo item de checklist (seed/blobs antigos não tinham) — o toggle depende disso.
  // E preenche o auto-snooze em blobs antigos (default: desligado, 10 min).
  return list.map((r, i) => ({
    ...r,
    checklist: (r.checklist ?? []).map((c) => (c.id ? c : { ...c, id: newId() })),
    autoSnooze: r.autoSnooze ?? false,
    snoozeIntervalMin: r.snoozeIntervalMin ?? 10,
    // Sem order salvo: usa a posição atual (primeiro = maior) para manter a ordem existente na desc.
    order: r.order ?? list.length - i,
  }))
}

function loadPeople(): Person[] {
  try {
    const raw = localStorage.getItem(PEOPLE_KEY)
    if (raw) return JSON.parse(raw) as Person[]
  } catch {
    /* ignora e cai no seed */
  }
  return SEED_PEOPLE.map((p) => ({ ...p }))
}

function loadWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(WS_KEY)
    if (raw) return JSON.parse(raw) as Workspace[]
  } catch {
    /* ignora */
  }
  return [] // sem seed: o usuário cria os próprios quadros
}

function loadWsMembers(): Record<string, WorkspaceMember[]> {
  try {
    const raw = localStorage.getItem(WS_MEMBERS_KEY)
    if (raw) return JSON.parse(raw) as Record<string, WorkspaceMember[]>
  } catch {
    /* ignora */
  }
  return {}
}

function loadComments(): Record<string, Comment[]> {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY)
    if (raw) return JSON.parse(raw) as Record<string, Comment[]>
  } catch {
    /* ignora */
  }
  return {}
}

function delay(ms = 120) {
  return new Promise((res) => setTimeout(res, ms))
}

interface MockLogistics {
  routes: Record<string, { city: City | null; boardId?: string | null; slot: RouteSlot; technicianId: string | null }>
  technicians: string[]
  boards?: LogisticsBoard[]
}

const CITY_LABEL: Record<City, string> = { serra: 'Serra', vitoria: 'Vitória', vv_cariacica: 'Vila Velha/Cariacica/Viana' }

function loadLogistics(): MockLogistics {
  try {
    const raw = localStorage.getItem(ROUTES_KEY)
    return raw ? (JSON.parse(raw) as MockLogistics) : { routes: {}, technicians: [] }
  } catch {
    return { routes: {}, technicians: [] }
  }
}

function loadCalls(): Record<string, ServiceCall> {
  try {
    const raw = localStorage.getItem(CALLS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ServiceCall>) : {}
  } catch {
    return {}
  }
}

/**
 * Serviço ativo. Com `.env` preenchido (`hasSupabase`), usa o Supabase; senão, o mock
 * em memória. A UI consome sempre a mesma interface — não sabe qual está por baixo.
 */
export const notesService: NotesService = hasSupabase
  ? new SupabaseNotesService()
  : new MockNotesService()

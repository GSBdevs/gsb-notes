import type { Attachment, Comment, Perm, Person, Reminder, ReminderDraft, Share, Workspace, WorkspaceMember } from '@/types'
import { SEED_PEOPLE, SEED_REMINDERS } from '@/data/mock'
import { deriveStatus, formatRemindAt } from '@/lib/reminders'
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
  /** Marca que EU vi este lembrete (recibo "visto por"). Best-effort; só faz sentido em nota alheia. */
  markSeen(id: string): Promise<void>
  listPeople(): Promise<Person[]>
  /** Muda a permissão de uma pessoa em TODOS os lembretes compartilhados com ela (ação em massa). */
  updatePersonPerm(userId: string, perm: Perm): Promise<void>
  /** Muda a permissão de UMA pessoa em UM lembrete específico (controle por-nota). */
  updateSharePerm(noteId: string, userId: string, perm: Perm): Promise<void>
  removePerson(userId: string): Promise<void>
  /** Busca uma pessoa pelo e-mail exato (para compartilhar). Null se não achar. */
  findPersonByEmail(email: string): Promise<Share | null>

  // ── Quadros compartilhados (workspaces) ──
  listWorkspaces(): Promise<Workspace[]>
  createWorkspace(name: string, color: string): Promise<Workspace>
  updateWorkspace(id: string, patch: { name?: string; color?: string }): Promise<void>
  /** Exclui o quadro (só o dono). Os lembretes voltam a ser pessoais (workspace_id = null). */
  deleteWorkspace(id: string): Promise<void>
  listWorkspaceMembers(id: string): Promise<WorkspaceMember[]>
  /** Adiciona por e-mail exato. Null se não achar usuário. */
  addWorkspaceMember(id: string, email: string): Promise<WorkspaceMember | null>
  removeWorkspaceMember(id: string, userId: string): Promise<void>
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
}

const STORAGE_KEY = 'sb-notas.reminders.v1'
const PEOPLE_KEY = 'sb-notas.people.v1'
const WS_KEY = 'sb-notas.workspaces.v1'
const WS_MEMBERS_KEY = 'sb-notas.workspace-members.v1'
const COMMENTS_KEY = 'sb-notas.comments.v1'
/** Membro "dono" fixo do mock (single-user). */
const MOCK_OWNER: WorkspaceMember = {
  userId: 'me',
  name: 'Você',
  initials: 'VC',
  color: '#FACC15',
  isOwner: true,
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
      status: deriveStatus('active', draft.remindAt),
      shares: draft.shares,
      tags: draft.tags,
      mine: true,
      reads: [],
      workspaceId: draft.workspaceId,
    }
    this.reminders = [reminder, ...this.reminders]
    this.persist()
    return { ...reminder }
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
        status: r.status === 'archived' ? 'archived' : deriveStatus('active', draft.remindAt),
        shares: draft.shares,
        tags: draft.tags,
        workspaceId: draft.workspaceId,
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
    this.persist()
  }

  async markSeen(_id: string) {
    // Mock é single-user: você é sempre o dono, então não há recibo a registrar. No-op.
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
    return this.workspaces.map((w) => ({ ...w, memberCount: (this.wsMembers[w.id] ?? []).length }))
  }

  async createWorkspace(name: string, color: string) {
    await delay()
    const ws: Workspace = {
      id: newId(),
      name: name.trim() || 'Quadro',
      color,
      ownerId: MOCK_OWNER.userId,
      mine: true,
      memberCount: 1,
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
    return (this.wsMembers[id] ?? []).map((m) => ({ ...m }))
  }

  async addWorkspaceMember(id: string, email: string) {
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
      isOwner: false,
    }
    this.wsMembers[id] = [...list, member]
    this.persistWorkspaces()
    return { ...member }
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Reminder[]
  } catch {
    /* ignora e cai no seed */
  }
  return SEED_REMINDERS.map((r) => ({ ...r }))
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

/**
 * Serviço ativo. Com `.env` preenchido (`hasSupabase`), usa o Supabase; senão, o mock
 * em memória. A UI consome sempre a mesma interface — não sabe qual está por baixo.
 */
export const notesService: NotesService = hasSupabase
  ? new SupabaseNotesService()
  : new MockNotesService()

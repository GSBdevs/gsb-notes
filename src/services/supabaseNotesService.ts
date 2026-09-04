import type { NotesService } from './notesService'
import type {
  Attachment,
  ChecklistItem,
  Comment,
  ContactInvite,
  InviteOutcome,
  Perm,
  Person,
  Priority,
  ReadReceipt,
  ReadResponse,
  Recurrence,
  RecurrenceRule,
  Reminder,
  ReminderDraft,
  Share,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '@/types'
import { supabase } from './supabase'
import { initialsFromName, normalizeSnoozeInterval } from '@/lib/constants'
import { deriveStatus, formatRemindAt } from '@/lib/reminders'

/** Guarda de não-nulo: o serviço só é instanciado quando `hasSupabase`. */
function sb() {
  if (!supabase) throw new Error('Supabase não configurado.')
  return supabase
}

async function uid(): Promise<string> {
  const { data } = await sb().auth.getUser()
  if (!data.user) throw new Error('Sem sessão ativa.')
  return data.user.id
}

// ── Mapeamento DB ↔ domínio ──────────────────────────────────────────────────
const PRIORITY_TO_NUM: Record<Priority, number> = { normal: 0, important: 1, urgent: 2 }
const NUM_TO_PRIORITY: Priority[] = ['normal', 'important', 'urgent']

const NOTE_COLS =
  'id, owner_id, workspace_id, kind, style, title, body, color, priority, pinned, remind_at, recurrence, status, tags, content, ' +
  // Perfil do DONO — desambigua a FK (há vários caminhos notes↔profiles via shares/reads/etc.).
  'profiles!notes_owner_id_fkey(display_name, avatar_color, avatar_url), ' +
  'note_shares(shared_with, permission, profiles(display_name, avatar_color, avatar_url)), ' +
  'note_reads(user_id, seen_at, response, responded_at), ' +
  // Checklist da tarefa (0016): itens + quem concluiu (done_by) + responsável (assignee, #7).
  'note_checklist_items(id, position, text, done, done_at, done_by, ' +
  'done_profile:profiles!note_checklist_items_done_by_fkey(display_name, avatar_color), ' +
  'assignee, assignee_profile:profiles!note_checklist_items_assignee_fkey(display_name, avatar_color, avatar_url))'

interface ProfileEmbed {
  display_name: string | null
  avatar_color: string | null
  avatar_url?: string | null
}
interface ShareRow {
  shared_with: string
  permission: string
  profiles: ProfileEmbed | ProfileEmbed[] | null
}
interface ReadRow {
  user_id: string
  seen_at: string
  response: string | null
  responded_at: string | null
}
interface ChecklistRow {
  id: string
  position: number
  text: string
  done: boolean
  done_at: string | null
  done_by: string | null
  done_profile: ProfileEmbed | ProfileEmbed[] | null
  assignee: string | null
  assignee_profile: ProfileEmbed | ProfileEmbed[] | null
}
interface InviteRow {
  id: string
  from_user: string
  to_user: string
  status: string
  created_at: string
  from_profile: ProfileEmbed | ProfileEmbed[] | null
  to_profile: ProfileEmbed | ProfileEmbed[] | null
}
interface WorkspaceRow {
  id: string
  owner_id: string
  name: string
  color: string
  workspace_members?: { user_id: string; role?: string }[]
}
interface MemberRow {
  user_id: string
  role?: string
  profiles: ProfileEmbed | ProfileEmbed[] | null
}

/** Normaliza um papel vindo do banco. */
function toRole(r: string | null | undefined): WorkspaceRole {
  return r === 'owner' || r === 'admin' || r === 'viewer' ? r : 'member'
}
interface CommentRow {
  id: string
  note_id: string
  author_id: string
  body: string
  created_at: string
  profiles: ProfileEmbed | ProfileEmbed[] | null
}
interface AttachmentRow {
  id: string
  note_id: string
  uploader_id: string
  path: string
  name: string
  size: number
  mime: string
  created_at: string
}

const ATTACH_BUCKET = 'note-attachments'
const SIGNED_URL_TTL = 60 * 60 // 1h
interface NoteRow {
  id: string
  owner_id: string
  workspace_id: string | null
  kind: string | null
  style: {
    checklist?: { text: string; done: boolean }[]
    locked?: boolean
    snooze?: { enabled?: boolean; intervalMin?: number }
    recur?: RecurrenceRule | null
  } | null
  title: string
  body: string
  color: string
  priority: number
  pinned: boolean
  remind_at: string | null
  recurrence: string
  status: string
  tags: string[] | null
  content?: unknown[] | null
  profiles?: ProfileEmbed | ProfileEmbed[] | null // dono
  note_shares?: ShareRow[]
  note_reads?: ReadRow[]
  note_checklist_items?: ChecklistRow[]
}

function toChecklistItem(row: ChecklistRow): ChecklistItem {
  const p = embed(row.done_profile)
  const a = embed(row.assignee_profile)
  const aName = a?.display_name ?? null
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    doneById: row.done_by,
    doneByName: p?.display_name ?? null,
    doneByColor: p?.avatar_color ?? null,
    doneAt: row.done_at,
    assigneeId: row.assignee,
    assigneeName: aName,
    assigneeInitials: aName ? initialsFromName(aName) : null,
    assigneeColor: a?.avatar_color ?? null,
    assigneeAvatar: a?.avatar_url ?? null,
  }
}

function embed(p: ShareRow['profiles']): ProfileEmbed | null {
  return Array.isArray(p) ? (p[0] ?? null) : p
}

function toShare(row: ShareRow): Share {
  const p = embed(row.profiles)
  const name = p?.display_name ?? 'Usuário'
  return {
    userId: row.shared_with,
    name,
    initials: initialsFromName(name),
    color: p?.avatar_color ?? '#94A3B8',
    avatarUrl: p?.avatar_url ?? null,
    perm: row.permission === 'edit' ? 'edit' : 'view',
  }
}

function toReceipt(row: ReadRow): ReadReceipt {
  return {
    userId: row.user_id,
    seenAt: row.seen_at,
    response: row.response === 'done' || row.response === 'snoozed' ? row.response : null,
    respondedAt: row.responded_at,
  }
}

function toComment(row: CommentRow, meId: string): Comment {
  const p = embed(row.profiles)
  const name = p?.display_name ?? 'Usuário'
  return {
    id: row.id,
    noteId: row.note_id,
    authorId: row.author_id,
    authorName: name,
    authorInitials: initialsFromName(name),
    authorColor: p?.avatar_color ?? '#94A3B8',
    authorAvatar: p?.avatar_url ?? null,
    body: row.body,
    createdAt: row.created_at,
    mine: row.author_id === meId,
  }
}

/** `meId` identifica o dono (recibos só valem para ele). Ausente → assume que é meu (create/update). */
function rowToReminder(row: NoteRow, meId?: string): Reminder {
  const rawStatus = row.status === 'archived' ? 'archived' : 'active'
  const owner = embed(row.profiles ?? null)
  const ownerName = owner?.display_name ?? 'Usuário'
  const shares = (row.note_shares ?? []).map(toShare)
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    color: row.color,
    priority: NUM_TO_PRIORITY[row.priority] ?? 'normal',
    pinned: row.pinned,
    remindAt: row.remind_at,
    time: formatRemindAt(row.remind_at),
    recurrence: (row.recurrence as Recurrence) ?? 'once',
    recurrenceRule: row.style?.recur ?? null,
    status: deriveStatus(rawStatus, row.remind_at),
    shares,
    tags: row.tags ?? [],
    mine: meId ? row.owner_id === meId : true,
    reads: (row.note_reads ?? []).map(toReceipt),
    workspaceId: row.workspace_id,
    ownerId: row.owner_id,
    ownerName,
    ownerColor: owner?.avatar_color ?? '#94A3B8',
    ownerAvatar: owner?.avatar_url ?? null,
    myShare: meId ? (shares.find((s) => s.userId === meId)?.perm ?? null) : null,
    kind: row.kind === 'doc' ? 'doc' : row.kind === 'block' ? 'block' : 'reminder',
    checklist: (row.note_checklist_items ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toChecklistItem),
    content: (row.content as unknown[] | null) ?? null,
    locked: row.style?.locked ?? false,
    autoSnooze: row.style?.snooze?.enabled ?? false,
    snoozeIntervalMin: normalizeSnoozeInterval(row.style?.snooze?.intervalMin),
  }
}

// ── Serviço ──────────────────────────────────────────────────────────────────
/**
 * Implementação Supabase da NotesService (Fase 2). Mesma interface do mock:
 * a UI não sabe qual está ativa. RLS no banco garante o isolamento por usuário.
 */
export class SupabaseNotesService implements NotesService {
  async listReminders(): Promise<Reminder[]> {
    const me = await uid()
    const { data, error } = await sb()
      .from('notes')
      .select(NOTE_COLS)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as unknown as NoteRow[]).map((row) => rowToReminder(row, me))
  }

  async createReminder(draft: ReminderDraft): Promise<Reminder> {
    const owner_id = await uid()
    const { data, error } = await sb()
      .from('notes')
      .insert({
        owner_id,
        title: draft.title.trim() || 'Sem título',
        body: draft.body,
        color: draft.color,
        priority: PRIORITY_TO_NUM[draft.priority],
        pinned: draft.pinned,
        recurrence: draft.recurrence,
        remind_at: draft.remindAt,
        tags: draft.tags,
        workspace_id: draft.workspaceId,
        kind: draft.kind,
        style: {
          snooze: { enabled: draft.autoSnooze, intervalMin: draft.snoozeIntervalMin },
          recur: draft.recurrenceRule ?? null,
        },
        status: 'active',
      })
      .select(NOTE_COLS)
      .single()
    if (error) throw error
    const created = data as unknown as NoteRow
    if (draft.shares.length) {
      await sb()
        .from('note_shares')
        .insert(draft.shares.map((s) => ({ note_id: created.id, shared_with: s.userId, permission: s.perm })))
    }
    // Semeia os itens da checklist (tarefa nova) na tabela própria — 0016.
    if (draft.kind === 'doc' && draft.checklist.length) {
      const { error: itemsErr } = await sb()
        .from('note_checklist_items')
        .insert(
          draft.checklist.map((c, i) => ({
            note_id: created.id,
            position: i,
            text: c.text,
            done: c.done,
          })),
        )
      if (itemsErr) throw itemsErr
    }
    return rowToReminder(created)
  }

  async updateReminder(id: string, draft: ReminderDraft): Promise<Reminder> {
    const me = await uid()
    const { data: upd, error } = await sb()
      .from('notes')
      .update({
        title: draft.title.trim() || 'Sem título',
        body: draft.body,
        color: draft.color,
        priority: PRIORITY_TO_NUM[draft.priority],
        pinned: draft.pinned,
        recurrence: draft.recurrence,
        remind_at: draft.remindAt,
        tags: draft.tags,
        workspace_id: draft.workspaceId,
        kind: draft.kind,
        // A checklist agora vive em note_checklist_items (0016), gerenciada ao vivo — não no style.
        // O style de lembrete/tarefa guarda auto-snooze + recorrência avançada (locked é só de blocos).
        style: {
          snooze: { enabled: draft.autoSnooze, intervalMin: draft.snoozeIntervalMin },
          recur: draft.recurrenceRule ?? null,
        },
      })
      .eq('id', id)
      .select('owner_id')
      .single()
    if (error) throw error
    // Só o DONO sincroniza os shares — a RLS de note_shares recusa não-donos, e sem este
    // guard quem tinha permissão de editar via "não foi possível salvar" (a nota salvava,
    // mas o sync de shares estourava depois).
    if ((upd as { owner_id: string }).owner_id === me) {
      await this.syncShares(id, draft.shares)
    }
    // Relê com os shares já sincronizados.
    const { data, error: e2 } = await sb().from('notes').select(NOTE_COLS).eq('id', id).single()
    if (e2) throw e2
    return rowToReminder(data as unknown as NoteRow, me)
  }

  /** Alinha os note_shares da nota ao estado desejado (upsert + remove ausentes). */
  private async syncShares(noteId: string, desired: Share[]): Promise<void> {
    if (desired.length) {
      const { error } = await sb()
        .from('note_shares')
        .upsert(
          desired.map((s) => ({ note_id: noteId, shared_with: s.userId, permission: s.perm })),
          { onConflict: 'note_id,shared_with' },
        )
      if (error) throw error
    }
    const keep = desired.map((s) => s.userId)
    let del = sb().from('note_shares').delete().eq('note_id', noteId)
    if (keep.length) del = del.not('shared_with', 'in', `(${keep.join(',')})`)
    const { error } = await del
    if (error) throw error
  }

  async setStatus(id: string, status: Reminder['status']): Promise<void> {
    // 'scheduled' não é persistido (é derivado de remind_at); mapeia para 'active'.
    const dbStatus = status === 'archived' ? 'archived' : 'active'
    const { error } = await sb().from('notes').update({ status: dbStatus }).eq('id', id)
    if (error) throw error
  }

  async setRemindAt(id: string, iso: string | null): Promise<void> {
    const { error } = await sb().from('notes').update({ remind_at: iso }).eq('id', id)
    if (error) throw error
  }

  async markSeen(id: string): Promise<void> {
    const me = await uid()
    // Upsert: primeira vez insere; revisões atualizam o seen_at. A RLS (0005) só deixa
    // marcar em nota compartilhada comigo — se eu for o dono, o banco recusa e ignoramos.
    const { error } = await sb()
      .from('note_reads')
      .upsert(
        { note_id: id, user_id: me, seen_at: new Date().toISOString() },
        { onConflict: 'note_id,user_id' },
      )
    if (error && import.meta.env.DEV) console.debug('markSeen ignorado:', error.message)
  }

  async markResponse(id: string, response: ReadResponse): Promise<void> {
    const me = await uid()
    // Upsert só de response/responded_at (omite seen_at → preserva o "visto" original;
    // no insert, seen_at usa o default now()). RLS: só em nota destinada a mim.
    const { error } = await sb()
      .from('note_reads')
      .upsert(
        { note_id: id, user_id: me, response, responded_at: new Date().toISOString() },
        { onConflict: 'note_id,user_id' },
      )
    if (error && import.meta.env.DEV) console.debug('markResponse ignorado:', error.message)
  }

  async listPeople(): Promise<Person[]> {
    const me = await uid()
    // Pessoas com quem EU compartilho: shares nas notas que eu possuo.
    const { data, error } = await sb()
      .from('note_shares')
      .select('shared_with, permission, profiles(display_name, avatar_color, avatar_url), notes!inner(owner_id)')
      .eq('notes.owner_id', me)
    if (error) throw error

    const byUser = new Map<string, Person>()
    for (const row of (data ?? []) as unknown as ShareRow[]) {
      const p = embed(row.profiles)
      const name = p?.display_name ?? 'Usuário'
      const existing = byUser.get(row.shared_with)
      if (existing) {
        if (row.permission === 'edit') existing.perm = 'edit' // agrega: edit vence view
      } else {
        byUser.set(row.shared_with, {
          userId: row.shared_with,
          name,
          initials: initialsFromName(name),
          color: p?.avatar_color ?? '#94A3B8',
          avatarUrl: p?.avatar_url ?? null,
          perm: row.permission === 'edit' ? 'edit' : 'view',
          online: false, // presença é v1 (Realtime Presence) — por ora, offline
        })
      }
    }

    // Contatos (adicionados por e-mail) sem lembrete compartilhado ainda.
    const { data: contacts } = await sb()
      .from('contacts')
      .select('contact_id, profiles!contacts_contact_id_fkey(display_name, avatar_color, avatar_url)')
    for (const row of (contacts ?? []) as unknown as { contact_id: string; profiles: ProfileEmbed | ProfileEmbed[] | null }[]) {
      if (byUser.has(row.contact_id)) continue
      const p = embed(row.profiles)
      const name = p?.display_name ?? 'Usuário'
      byUser.set(row.contact_id, {
        userId: row.contact_id,
        name,
        initials: initialsFromName(name),
        color: p?.avatar_color ?? '#94A3B8',
        avatarUrl: p?.avatar_url ?? null,
        perm: 'view',
        online: false,
        isContact: true,
      })
    }
    return [...byUser.values()]
  }

  // ── Convites de contato (0015) ──
  async listContactInvites(): Promise<ContactInvite[]> {
    const me = await uid()
    const { data, error } = await sb()
      .from('contact_invites')
      .select(
        'id, from_user, to_user, status, created_at, ' +
          'from_profile:profiles!contact_invites_from_user_fkey(display_name, avatar_color), ' +
          'to_profile:profiles!contact_invites_to_user_fkey(display_name, avatar_color)',
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as unknown as InviteRow[]).map((row) => {
      const incoming = row.to_user === me
      const p = embed(incoming ? row.from_profile : row.to_profile)
      const name = p?.display_name ?? 'Usuário'
      return {
        id: row.id,
        direction: incoming ? 'incoming' : 'outgoing',
        status: (row.status as ContactInvite['status']) ?? 'pending',
        userId: incoming ? row.from_user : row.to_user,
        name,
        initials: initialsFromName(name),
        color: p?.avatar_color ?? '#94A3B8',
        createdAt: row.created_at,
      }
    })
  }

  async sendContactInvite(email: string): Promise<InviteOutcome> {
    const me = await uid()
    const person = await this.findPersonByEmail(email) // exclui você mesmo
    if (!person) return 'not-found'
    // Já é contato?
    const { data: existing } = await sb()
      .from('contacts')
      .select('contact_id')
      .eq('owner_id', me)
      .eq('contact_id', person.userId)
      .maybeSingle()
    if (existing) return 'already-contact'
    // A pessoa já me convidou? Então aceitar em vez de duplicar.
    const { data: reverse } = await sb()
      .from('contact_invites')
      .select('id')
      .eq('from_user', person.userId)
      .eq('to_user', me)
      .eq('status', 'pending')
      .maybeSingle()
    if (reverse) {
      await this.respondContactInvite((reverse as { id: string }).id, true)
      return 'accepted'
    }
    const { error } = await sb()
      .from('contact_invites')
      .insert({ from_user: me, to_user: person.userId })
    if (error) {
      if (error.code === '23505') return 'already-pending' // convite já enviado
      throw error
    }
    return 'sent'
  }

  async respondContactInvite(id: string, accept: boolean): Promise<void> {
    // RLS: só o destinatário responde. O aceite cria os contatos (bidirecional) via trigger.
    const { error } = await sb()
      .from('contact_invites')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', id)
    if (error) throw error
  }

  // ── Checklist (0016) ──
  async addChecklistItem(noteId: string, text: string): Promise<void> {
    const t = text.trim()
    if (!t) return
    const { data } = await sb()
      .from('note_checklist_items')
      .select('position')
      .eq('note_id', noteId)
      .order('position', { ascending: false })
      .limit(1)
    const nextPos = ((data?.[0] as { position: number } | undefined)?.position ?? -1) + 1
    const { error } = await sb()
      .from('note_checklist_items')
      .insert({ note_id: noteId, text: t, position: nextPos, done: false })
    if (error) throw error
  }

  async renameChecklistItem(itemId: string, text: string): Promise<void> {
    const { error } = await sb()
      .from('note_checklist_items')
      .update({ text: text.trim() })
      .eq('id', itemId)
    if (error) throw error
  }

  async removeChecklistItem(itemId: string): Promise<void> {
    const { error } = await sb().from('note_checklist_items').delete().eq('id', itemId)
    if (error) throw error
  }

  async toggleChecklistItem(itemId: string, done: boolean): Promise<void> {
    // RPC SECURITY DEFINER: libera o toggle a quem só vê e conclui/reabre a tarefa.
    const { error } = await sb().rpc('toggle_checklist_item', { p_item: itemId, p_done: done })
    if (error) throw error
  }

  async assignChecklistItem(itemId: string, userId: string | null): Promise<void> {
    // Atribuir "quem deve" = UPDATE do item; RLS (can_edit_note) já restringe a editores.
    const { error } = await sb()
      .from('note_checklist_items')
      .update({ assignee: userId })
      .eq('id', itemId)
    if (error) throw error
  }

  // ── Blocos (0018) ──
  async createBlock(): Promise<Reminder> {
    const owner_id = await uid()
    const { data, error } = await sb()
      .from('notes')
      .insert({ owner_id, title: 'Sem título', kind: 'block', content: [], style: {}, status: 'active' })
      .select(NOTE_COLS)
      .single()
    if (error) throw error
    return rowToReminder(data as unknown as NoteRow)
  }

  async saveBlock(id: string, patch: { title?: string; content?: unknown; locked?: boolean }): Promise<void> {
    const fields: Record<string, unknown> = {}
    if (patch.title !== undefined) fields.title = patch.title.trim() || 'Sem título'
    if (patch.content !== undefined) fields.content = patch.content
    // style de bloco guarda só `locked` — setar o objeto inteiro é seguro aqui.
    if (patch.locked !== undefined) fields.style = { locked: patch.locked }
    if (Object.keys(fields).length === 0) return
    const { error } = await sb().from('notes').update(fields).eq('id', id)
    if (error) throw error
  }

  async deleteNote(id: string): Promise<void> {
    // RLS notes_delete: só o dono exclui.
    const { error } = await sb().from('notes').delete().eq('id', id)
    if (error) throw error
  }

  async setNoteShares(noteId: string, shares: Share[]): Promise<void> {
    // Reusa o alinhamento de shares (upsert + remove ausentes). RLS: só o dono da nota.
    await this.syncShares(noteId, shares)
  }

  async updatePersonPerm(userId: string, perm: Perm): Promise<void> {
    // RLS (owns_note) garante que só os shares das MINHAS notas sejam alterados.
    const { error } = await sb().from('note_shares').update({ permission: perm }).eq('shared_with', userId)
    if (error) throw error
  }

  async updateSharePerm(noteId: string, userId: string, perm: Perm): Promise<void> {
    // Um único share (nota+pessoa). RLS (owns_note) protege: só o dono da nota altera.
    const { error } = await sb()
      .from('note_shares')
      .update({ permission: perm })
      .eq('note_id', noteId)
      .eq('shared_with', userId)
    if (error) throw error
  }

  async removePerson(userId: string): Promise<void> {
    const me = await uid()
    const { error } = await sb().from('note_shares').delete().eq('shared_with', userId)
    if (error) throw error
    // Remove também da lista de contatos (se for só contato, é isto que o tira da tela).
    await sb().from('contacts').delete().eq('owner_id', me).eq('contact_id', userId)
  }

  async findPersonByEmail(email: string): Promise<Share | null> {
    const { data, error } = await sb().rpc('find_profile_by_email', { p_email: email })
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as
      | { id: string; display_name: string | null; avatar_color: string | null }
      | undefined
    if (!row) return null
    const name = row.display_name ?? 'Usuário'
    return { userId: row.id, name, initials: initialsFromName(name), color: row.avatar_color ?? '#94A3B8', perm: 'view' }
  }

  // ── Workspaces (quadros compartilhados) ──
  async listWorkspaces(): Promise<Workspace[]> {
    const me = await uid()
    const { data, error } = await sb()
      .from('workspaces')
      .select('id, owner_id, name, color, workspace_members(user_id, role)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as unknown as WorkspaceRow[]).map((w) => {
      const members = w.workspace_members ?? []
      const myMember = members.find((m) => m.user_id === me)
      const myRole: WorkspaceRole | null = myMember
        ? toRole(myMember.role)
        : w.owner_id === me
          ? 'owner'
          : null
      return {
        id: w.id,
        name: w.name,
        color: w.color,
        ownerId: w.owner_id,
        mine: w.owner_id === me,
        memberCount: members.length,
        myRole,
      }
    })
  }

  async createWorkspace(name: string, color: string): Promise<Workspace> {
    const owner_id = await uid()
    const { data, error } = await sb()
      .from('workspaces')
      .insert({ owner_id, name: name.trim() || 'Quadro', color })
      .select('id, owner_id, name, color')
      .single()
    if (error) throw error
    const w = data as unknown as WorkspaceRow
    // O dono também é membro, com papel 'owner'.
    const { error: e2 } = await sb()
      .from('workspace_members')
      .insert({ workspace_id: w.id, user_id: owner_id, role: 'owner' })
    if (e2) throw e2
    return { id: w.id, name: w.name, color: w.color, ownerId: owner_id, mine: true, memberCount: 1, myRole: 'owner' }
  }

  async updateWorkspace(id: string, patch: { name?: string; color?: string }): Promise<void> {
    const fields: Record<string, string> = {}
    if (patch.name !== undefined) fields.name = patch.name.trim() || 'Quadro'
    if (patch.color !== undefined) fields.color = patch.color
    if (Object.keys(fields).length === 0) return
    const { error } = await sb().from('workspaces').update(fields).eq('id', id)
    if (error) throw error
  }

  async deleteWorkspace(id: string): Promise<void> {
    // FK on delete set null: os lembretes do quadro voltam a ser pessoais.
    const { error } = await sb().from('workspaces').delete().eq('id', id)
    if (error) throw error
  }

  async listWorkspaceMembers(id: string): Promise<WorkspaceMember[]> {
    const { data: wsRow } = await sb().from('workspaces').select('owner_id').eq('id', id).single()
    const ownerId = (wsRow as { owner_id: string } | null)?.owner_id
    const { data, error } = await sb()
      .from('workspace_members')
      .select('user_id, role, profiles(display_name, avatar_color, avatar_url)')
      .eq('workspace_id', id)
    if (error) throw error
    return ((data ?? []) as unknown as MemberRow[]).map((row) => {
      const p = embed(row.profiles)
      const name = p?.display_name ?? 'Usuário'
      return {
        userId: row.user_id,
        name,
        initials: initialsFromName(name),
        color: p?.avatar_color ?? '#94A3B8',
        avatarUrl: p?.avatar_url ?? null,
        isOwner: row.user_id === ownerId,
        role: toRole(row.role),
      }
    })
  }

  async addWorkspaceMember(id: string, email: string, role: WorkspaceRole = 'member'): Promise<WorkspaceMember | null> {
    const person = await this.findPersonByEmail(email) // exclui você mesmo (já é dono/membro)
    if (!person) return null
    const { error } = await sb()
      .from('workspace_members')
      .insert({ workspace_id: id, user_id: person.userId, role })
    if (error) {
      if (error.code === '23505') return null // já é membro (PK duplicada)
      throw error
    }
    return {
      userId: person.userId,
      name: person.name,
      initials: person.initials,
      color: person.color,
      avatarUrl: person.avatarUrl ?? null,
      isOwner: false,
      role,
    }
  }

  async addWorkspaceMemberByUser(id: string, userId: string, role: WorkspaceRole = 'member'): Promise<boolean> {
    // RLS: dono/admin do quadro adiciona membros. Insere direto pelo userId (contato conhecido).
    const { error } = await sb()
      .from('workspace_members')
      .insert({ workspace_id: id, user_id: userId, role })
    if (error) {
      if (error.code === '23505') return false // já é membro (PK duplicada)
      throw error
    }
    return true
  }

  async setMemberRole(id: string, userId: string, role: WorkspaceRole): Promise<void> {
    // RLS: só o dono do quadro muda papéis.
    const { error } = await sb()
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', id)
      .eq('user_id', userId)
    if (error) throw error
  }

  async removeWorkspaceMember(id: string, userId: string): Promise<void> {
    const { error } = await sb()
      .from('workspace_members')
      .delete()
      .eq('workspace_id', id)
      .eq('user_id', userId)
    if (error) throw error
  }

  async leaveWorkspace(id: string): Promise<void> {
    const me = await uid()
    await this.removeWorkspaceMember(id, me)
  }

  // ── Comentários ──
  async listComments(noteId: string): Promise<Comment[]> {
    const me = await uid()
    const { data, error } = await sb()
      .from('note_comments')
      .select('id, note_id, author_id, body, created_at, profiles(display_name, avatar_color, avatar_url)')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((data ?? []) as unknown as CommentRow[]).map((r) => toComment(r, me))
  }

  async addComment(noteId: string, body: string): Promise<Comment> {
    const me = await uid()
    const { data, error } = await sb()
      .from('note_comments')
      .insert({ note_id: noteId, author_id: me, body: body.trim() })
      .select('id, note_id, author_id, body, created_at, profiles(display_name, avatar_color, avatar_url)')
      .single()
    if (error) throw error
    return toComment(data as unknown as CommentRow, me)
  }

  async deleteComment(id: string): Promise<void> {
    // RLS (autor ou dono da nota) protege quem pode apagar.
    const { error } = await sb().from('note_comments').delete().eq('id', id)
    if (error) throw error
  }

  // ── Anexos (metadados em note_attachments + bytes no Storage) ──
  async listAttachments(noteId: string): Promise<Attachment[]> {
    const me = await uid()
    const { data, error } = await sb()
      .from('note_attachments')
      .select('id, note_id, uploader_id, path, name, size, mime, created_at')
      .eq('note_id', noteId)
      .order('created_at', { ascending: true })
    if (error) throw error
    const rows = (data ?? []) as unknown as AttachmentRow[]
    if (rows.length === 0) return []
    // URLs assinadas em lote (bucket é privado).
    const { data: signed } = await sb()
      .storage.from(ATTACH_BUCKET)
      .createSignedUrls(rows.map((r) => r.path), SIGNED_URL_TTL)
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    return rows.map((r) => ({
      id: r.id,
      noteId: r.note_id,
      name: r.name,
      size: r.size,
      mime: r.mime,
      url: urlByPath.get(r.path) ?? '',
      uploaderId: r.uploader_id,
      createdAt: r.created_at,
      mine: r.uploader_id === me,
    }))
  }

  async addAttachment(noteId: string, file: File): Promise<Attachment> {
    const me = await uid()
    const path = `${noteId}/${crypto.randomUUID()}`
    const { error: upErr } = await sb()
      .storage.from(ATTACH_BUCKET)
      .upload(path, file, { contentType: file.type || undefined, upsert: false })
    if (upErr) throw upErr

    const { data, error } = await sb()
      .from('note_attachments')
      .insert({ note_id: noteId, uploader_id: me, path, name: file.name, size: file.size, mime: file.type })
      .select('id, note_id, uploader_id, path, name, size, mime, created_at')
      .single()
    if (error) {
      // Rollback do arquivo se o insert do metadado falhar (não deixa órfão).
      await sb().storage.from(ATTACH_BUCKET).remove([path])
      throw error
    }
    const row = data as unknown as AttachmentRow
    const { data: signed } = await sb().storage.from(ATTACH_BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
    return {
      id: row.id,
      noteId: row.note_id,
      name: row.name,
      size: row.size,
      mime: row.mime,
      url: signed?.signedUrl ?? '',
      uploaderId: row.uploader_id,
      createdAt: row.created_at,
      mine: true,
    }
  }

  async deleteAttachment(id: string): Promise<void> {
    // Pega o path, remove o arquivo do Storage e apaga o metadado (RLS: uploader ou dono).
    const { data, error } = await sb()
      .from('note_attachments')
      .select('path')
      .eq('id', id)
      .single()
    if (error) throw error
    const path = (data as { path: string }).path
    await sb().storage.from(ATTACH_BUCKET).remove([path])
    const { error: delErr } = await sb().from('note_attachments').delete().eq('id', id)
    if (delErr) throw delErr
  }
}

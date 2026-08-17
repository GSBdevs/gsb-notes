import type { NotesService } from './notesService'
import type {
  Comment,
  Perm,
  Person,
  Priority,
  ReadReceipt,
  Recurrence,
  Reminder,
  ReminderDraft,
  Share,
  Workspace,
  WorkspaceMember,
} from '@/types'
import { supabase } from './supabase'
import { initialsFromName } from '@/lib/constants'
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
  'id, owner_id, workspace_id, title, body, color, priority, pinned, remind_at, recurrence, status, tags, ' +
  'note_shares(shared_with, permission, profiles(display_name, avatar_color)), ' +
  'note_reads(user_id, seen_at)'

interface ProfileEmbed {
  display_name: string | null
  avatar_color: string | null
}
interface ShareRow {
  shared_with: string
  permission: string
  profiles: ProfileEmbed | ProfileEmbed[] | null
}
interface ReadRow {
  user_id: string
  seen_at: string
}
interface WorkspaceRow {
  id: string
  owner_id: string
  name: string
  color: string
  workspace_members?: { user_id: string }[]
}
interface MemberRow {
  user_id: string
  profiles: ProfileEmbed | ProfileEmbed[] | null
}
interface CommentRow {
  id: string
  note_id: string
  author_id: string
  body: string
  created_at: string
  profiles: ProfileEmbed | ProfileEmbed[] | null
}
interface NoteRow {
  id: string
  owner_id: string
  workspace_id: string | null
  title: string
  body: string
  color: string
  priority: number
  pinned: boolean
  remind_at: string | null
  recurrence: string
  status: string
  tags: string[] | null
  note_shares?: ShareRow[]
  note_reads?: ReadRow[]
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
    perm: row.permission === 'edit' ? 'edit' : 'view',
  }
}

function toReceipt(row: ReadRow): ReadReceipt {
  return { userId: row.user_id, seenAt: row.seen_at }
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
    body: row.body,
    createdAt: row.created_at,
    mine: row.author_id === meId,
  }
}

/** `meId` identifica o dono (recibos só valem para ele). Ausente → assume que é meu (create/update). */
function rowToReminder(row: NoteRow, meId?: string): Reminder {
  const rawStatus = row.status === 'archived' ? 'archived' : 'active'
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
    status: deriveStatus(rawStatus, row.remind_at),
    shares: (row.note_shares ?? []).map(toShare),
    tags: row.tags ?? [],
    mine: meId ? row.owner_id === meId : true,
    reads: (row.note_reads ?? []).map(toReceipt),
    workspaceId: row.workspace_id,
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
    return rowToReminder(created)
  }

  async updateReminder(id: string, draft: ReminderDraft): Promise<Reminder> {
    const { error } = await sb()
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
      })
      .eq('id', id)
    if (error) throw error
    await this.syncShares(id, draft.shares)
    // Relê com os shares já sincronizados.
    const { data, error: e2 } = await sb().from('notes').select(NOTE_COLS).eq('id', id).single()
    if (e2) throw e2
    return rowToReminder(data as unknown as NoteRow)
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

  async listPeople(): Promise<Person[]> {
    const me = await uid()
    // Pessoas com quem EU compartilho: shares nas notas que eu possuo.
    const { data, error } = await sb()
      .from('note_shares')
      .select('shared_with, permission, profiles(display_name, avatar_color), notes!inner(owner_id)')
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
          perm: row.permission === 'edit' ? 'edit' : 'view',
          online: false, // presença é v1 (Realtime Presence) — por ora, offline
        })
      }
    }
    return [...byUser.values()]
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
    const { error } = await sb().from('note_shares').delete().eq('shared_with', userId)
    if (error) throw error
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
      .select('id, owner_id, name, color, workspace_members(user_id)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as unknown as WorkspaceRow[]).map((w) => ({
      id: w.id,
      name: w.name,
      color: w.color,
      ownerId: w.owner_id,
      mine: w.owner_id === me,
      memberCount: (w.workspace_members ?? []).length,
    }))
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
    // O dono também é membro (para is_workspace_member cobri-lo).
    const { error: e2 } = await sb()
      .from('workspace_members')
      .insert({ workspace_id: w.id, user_id: owner_id })
    if (e2) throw e2
    return { id: w.id, name: w.name, color: w.color, ownerId: owner_id, mine: true, memberCount: 1 }
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
      .select('user_id, profiles(display_name, avatar_color)')
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
        isOwner: row.user_id === ownerId,
      }
    })
  }

  async addWorkspaceMember(id: string, email: string): Promise<WorkspaceMember | null> {
    const person = await this.findPersonByEmail(email) // exclui você mesmo (já é dono/membro)
    if (!person) return null
    const { error } = await sb()
      .from('workspace_members')
      .insert({ workspace_id: id, user_id: person.userId })
    if (error) {
      if (error.code === '23505') return null // já é membro (PK duplicada)
      throw error
    }
    return {
      userId: person.userId,
      name: person.name,
      initials: person.initials,
      color: person.color,
      isOwner: false,
    }
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
      .select('id, note_id, author_id, body, created_at, profiles(display_name, avatar_color)')
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
      .select('id, note_id, author_id, body, created_at, profiles(display_name, avatar_color)')
      .single()
    if (error) throw error
    return toComment(data as unknown as CommentRow, me)
  }

  async deleteComment(id: string): Promise<void> {
    // RLS (autor ou dono da nota) protege quem pode apagar.
    const { error } = await sb().from('note_comments').delete().eq('id', id)
    if (error) throw error
  }
}

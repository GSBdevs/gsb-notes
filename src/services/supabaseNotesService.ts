import type { NotesService } from './notesService'
import type { Perm, Person, Priority, Recurrence, Reminder, ReminderDraft, Share } from '@/types'
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
  'id, title, body, color, priority, pinned, remind_at, recurrence, status, ' +
  'note_shares(shared_with, permission, profiles(display_name, avatar_color))'

interface ProfileEmbed {
  display_name: string | null
  avatar_color: string | null
}
interface ShareRow {
  shared_with: string
  permission: string
  profiles: ProfileEmbed | ProfileEmbed[] | null
}
interface NoteRow {
  id: string
  title: string
  body: string
  color: string
  priority: number
  pinned: boolean
  remind_at: string | null
  recurrence: string
  status: string
  note_shares?: ShareRow[]
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

function rowToReminder(row: NoteRow): Reminder {
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
  }
}

// ── Serviço ──────────────────────────────────────────────────────────────────
/**
 * Implementação Supabase da NotesService (Fase 2). Mesma interface do mock:
 * a UI não sabe qual está ativa. RLS no banco garante o isolamento por usuário.
 */
export class SupabaseNotesService implements NotesService {
  async listReminders(): Promise<Reminder[]> {
    const { data, error } = await sb()
      .from('notes')
      .select(NOTE_COLS)
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as unknown as NoteRow[]).map(rowToReminder)
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
}

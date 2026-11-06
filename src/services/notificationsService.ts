import type { AppNotification, NotificationType } from '@/types'
import { initialsFromName } from '@/lib/constants'
import { hasSupabase, supabase } from './supabase'

/** Caixa de notificações do usuário (sino da topbar). Ver migração 0014. */
export interface NotificationsService {
  list(): Promise<AppNotification[]>
  markRead(id: string): Promise<void>
  markAllRead(): Promise<void>
  /** Mescla campos em `data` (ex.: desfecho de um convite: aceito/recusado). */
  setData(id: string, patch: Record<string, unknown>): Promise<void>
}

interface ProfileEmbed {
  display_name: string | null
  avatar_color: string | null
  avatar_url?: string | null
}
interface NotificationRow {
  id: string
  type: string
  actor_id: string | null
  note_id: string | null
  title: string
  body: string
  data: Record<string, unknown> | null
  read_at: string | null
  created_at: string
  // Desambigua a FK: notifications tem user_id E actor_id apontando para profiles.
  actor: ProfileEmbed | ProfileEmbed[] | null
}

function embed(p: NotificationRow['actor']): ProfileEmbed | null {
  return Array.isArray(p) ? (p[0] ?? null) : p
}

function toNotification(row: NotificationRow): AppNotification {
  const p = embed(row.actor)
  const name = p?.display_name ?? 'Alguém'
  return {
    id: row.id,
    type: row.type as NotificationType,
    actorId: row.actor_id,
    actorName: name,
    actorInitials: initialsFromName(name),
    actorColor: p?.avatar_color ?? '#94A3B8',
    actorAvatar: p?.avatar_url ?? null,
    noteId: row.note_id,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    read: row.read_at !== null,
    createdAt: row.created_at,
  }
}

const NOTIF_COLS =
  'id, type, actor_id, note_id, title, body, data, read_at, created_at, ' +
  'actor:profiles!notifications_actor_id_fkey(display_name, avatar_color, avatar_url)'

class SupabaseNotificationsService implements NotificationsService {
  private sb() {
    if (!supabase) throw new Error('Supabase não configurado.')
    return supabase
  }

  async list(): Promise<AppNotification[]> {
    const { data, error } = await this.sb()
      .from('notifications')
      .select(NOTIF_COLS)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return ((data ?? []) as unknown as NotificationRow[]).map(toNotification)
  }

  async markRead(id: string): Promise<void> {
    const { error } = await this.sb()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  }

  async markAllRead(): Promise<void> {
    const { error } = await this.sb()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
    if (error) throw error
  }

  async setData(id: string, patch: Record<string, unknown>): Promise<void> {
    // Read-modify-write do jsonb `data` preservando o que já existe.
    const { data: cur } = await this.sb().from('notifications').select('data').eq('id', id).maybeSingle()
    const merged = { ...(((cur as { data?: Record<string, unknown> } | null)?.data) ?? {}), ...patch }
    const { error } = await this.sb().from('notifications').update({ data: merged }).eq('id', id)
    if (error) throw error
  }
}

/** Mock (single-user): sem ninguém para notificar, a caixa fica vazia. */
class MockNotificationsService implements NotificationsService {
  async list(): Promise<AppNotification[]> {
    return []
  }
  async markRead(): Promise<void> {}
  async markAllRead(): Promise<void> {}
  async setData(): Promise<void> {}
}

export const notificationsService: NotificationsService = hasSupabase
  ? new SupabaseNotificationsService()
  : new MockNotificationsService()

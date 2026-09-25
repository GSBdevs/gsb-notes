import { supabase, hasSupabase } from './supabase'
import type { AdminUser, AdminUserNote, AppRole, NoteKind, Status } from '@/types'

/**
 * Administração da hierarquia GLOBAL (migração 0024). Só o MASTER usa listUsers/setRole/etc.
 * A troca de senha passa por uma Edge Function (service_role no servidor) — nunca no cliente.
 */
export interface AdminService {
  /** Papel do usuário logado (default 'member'). Usado para liberar o painel só ao master. */
  getMyRole(): Promise<AppRole>
  /** Lista todos os usuários (só o master recebe dados). */
  listUsers(): Promise<AdminUser[]>
  /** Define admin/member para um usuário (só o master). */
  setRole(userId: string, role: 'admin' | 'member'): Promise<void>
  /** Define uma nova senha para um usuário (Edge Function; só o master). */
  resetPassword(userId: string, password: string): Promise<void>
  /** Notas de um usuário para o master visualizar (read-only). */
  getUserNotes(userId: string): Promise<AdminUserNote[]>
}

interface RoleRow {
  role: AppRole
}
interface AdminUserRow {
  user_id: string
  display_name: string
  email: string
  avatar_color: string
  avatar_url: string | null
  role: AppRole
}
interface AdminNoteRow {
  id: string
  kind: string
  title: string
  status: string
  created_at: string
}

class SupabaseAdminService implements AdminService {
  async getMyRole(): Promise<AppRole> {
    if (!supabase) return 'member'
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) return 'member'
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', uid).maybeSingle()
    return ((data as RoleRow | null)?.role as AppRole) ?? 'member'
  }

  async listUsers(): Promise<AdminUser[]> {
    if (!supabase) return []
    const { data, error } = await supabase.rpc('admin_list_users')
    if (error) throw error
    return ((data ?? []) as AdminUserRow[]).map((r) => ({
      userId: r.user_id,
      name: r.display_name,
      email: r.email,
      color: r.avatar_color,
      avatarUrl: r.avatar_url,
      role: r.role,
    }))
  }

  async setRole(userId: string, role: 'admin' | 'member'): Promise<void> {
    if (!supabase) return
    const { error } = await supabase.rpc('admin_set_role', { target: userId, new_role: role })
    if (error) throw error
  }

  async resetPassword(userId: string, password: string): Promise<void> {
    if (!supabase) return
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { userId, password },
    })
    if (error) throw error
    const res = data as { ok?: boolean; error?: string } | null
    if (res?.error) throw new Error(res.error)
  }

  async getUserNotes(userId: string): Promise<AdminUserNote[]> {
    if (!supabase) return []
    const { data, error } = await supabase.rpc('admin_get_user_notes', { target: userId })
    if (error) throw error
    return ((data ?? []) as AdminNoteRow[]).map((r) => ({
      id: r.id,
      kind: (r.kind as NoteKind) ?? 'reminder',
      title: r.title,
      status: (r.status as Status) ?? 'active',
      createdAt: r.created_at,
    }))
  }
}

/** Mock (sem backend): sem hierarquia — o painel não aparece. */
class MockAdminService implements AdminService {
  async getMyRole(): Promise<AppRole> {
    return 'member'
  }
  async listUsers(): Promise<AdminUser[]> {
    return []
  }
  async setRole(): Promise<void> {}
  async resetPassword(): Promise<void> {}
  async getUserNotes(): Promise<AdminUserNote[]> {
    return []
  }
}

export const adminService: AdminService = hasSupabase
  ? new SupabaseAdminService()
  : new MockAdminService()

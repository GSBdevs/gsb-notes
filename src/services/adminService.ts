import { supabase, hasSupabase } from './supabase'
import type { AdminUser, AdminUserNote, AppRole, NewUserInput, NoteKind, Status } from '@/types'

/**
 * Administração da hierarquia GLOBAL (migração 0024). Só o MASTER usa listUsers/setRole/etc.
 * A troca de senha passa por uma Edge Function (service_role no servidor) — nunca no cliente.
 */
export interface AdminService {
  /** Papel do usuário logado (default 'member'). Usado para liberar o painel só ao master. */
  getMyRole(): Promise<AppRole>
  /** Lista todos os usuários (só o master recebe dados). */
  listUsers(): Promise<AdminUser[]>
  /** Define admin/suporte/member para um usuário (só o master). Suporte = 0038 (Logística). */
  setRole(userId: string, role: 'admin' | 'suporte' | 'member'): Promise<void>
  /** Define uma nova senha para um usuário (Edge Function; só o master). */
  resetPassword(userId: string, password: string): Promise<void>
  /** Cria um usuário que já consegue entrar (Edge Function; só o master). */
  createUser(input: NewUserInput): Promise<void>
  /** Bloqueia ou libera o acesso de um usuário (Edge Function; só o master). */
  setBlocked(userId: string, blocked: boolean): Promise<void>
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
  /** Ausente até a migração 0041 ser rodada. */
  blocked?: boolean
}
interface AdminNoteRow {
  id: string
  kind: string
  title: string
  status: string
  created_at: string
}

/** Chama a Edge Function admin-users e devolve a mensagem real de erro (não o "non-2xx" genérico). */
async function invokeAdminUsers(body: Record<string, unknown>): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    const response = (error as { context?: Response }).context
    const detail = await response
      ?.json()
      .then((r: { error?: string }) => r.error)
      .catch(() => undefined)
    throw new Error(detail ?? 'Não foi possível concluir. Verifique se a função admin-users foi publicada.')
  }
  const res = data as { ok?: boolean; error?: string } | null
  if (res?.error) throw new Error(res.error)
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
      blocked: !!r.blocked,
    }))
  }

  async setRole(userId: string, role: 'admin' | 'suporte' | 'member'): Promise<void> {
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

  async createUser(input: NewUserInput): Promise<void> {
    await invokeAdminUsers({ action: 'create', ...input })
  }

  async setBlocked(userId: string, blocked: boolean): Promise<void> {
    await invokeAdminUsers({ action: blocked ? 'block' : 'unblock', userId })
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

/**
 * Mock (sem backend): sem hierarquia — o painel não aparece. Para inspecionar telas de papel no preview
 * mock, dá para forçar um papel com `localStorage['sb-notas.mock-role'] = 'master'` (só dev/mock).
 */
class MockAdminService implements AdminService {
  private users: AdminUser[] = []

  async getMyRole(): Promise<AppRole> {
    try {
      const r = localStorage.getItem('sb-notas.mock-role')
      if (r === 'master' || r === 'admin' || r === 'suporte') return r
    } catch {
      /* sem storage: membro */
    }
    return 'member'
  }
  async listUsers(): Promise<AdminUser[]> {
    return this.users
  }
  async setRole(): Promise<void> {}
  async resetPassword(): Promise<void> {}
  async createUser(input: NewUserInput): Promise<void> {
    this.users = [
      ...this.users,
      {
        userId: crypto.randomUUID(),
        name: input.name,
        email: input.email,
        color: '#FACC15',
        role: input.role,
        blocked: false,
      },
    ]
  }
  async setBlocked(userId: string, blocked: boolean): Promise<void> {
    this.users = this.users.map((u) => (u.userId === userId ? { ...u, blocked } : u))
  }
  async getUserNotes(): Promise<AdminUserNote[]> {
    return []
  }
}

export const adminService: AdminService = hasSupabase
  ? new SupabaseAdminService()
  : new MockAdminService()

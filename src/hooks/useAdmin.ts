import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminService } from '@/services/adminService'
import type { NewUserInput } from '@/types'

const ROLE_KEY = ['my-role'] as const
const USERS_KEY = ['admin-users'] as const

/** Papel do usuário logado (para liberar o painel do master). */
export function useMyRole() {
  return useQuery({
    queryKey: ROLE_KEY,
    queryFn: () => adminService.getMyRole(),
    staleTime: 5 * 60_000,
  })
}

/** Lista de usuários (habilitada só quando `enabled`, ex.: sou master). */
export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => adminService.listUsers(),
    enabled,
    staleTime: 60_000,
  })
}

export function useSetUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'admin' | 'suporte' | 'member' }) =>
      adminService.setRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      adminService.resetPassword(userId, password),
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: NewUserInput) => adminService.createUser(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useSetUserBlocked() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) =>
      adminService.setBlocked(userId, blocked),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useAdminUserNotes(userId: string | null) {
  return useQuery({
    queryKey: ['admin-user-notes', userId],
    queryFn: () => adminService.getUserNotes(userId as string),
    enabled: !!userId,
    staleTime: 30_000,
  })
}

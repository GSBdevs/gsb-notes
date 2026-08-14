import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'

const KEY = ['workspaces'] as const
const membersKey = (id: string) => ['workspace-members', id] as const

/** Lista de quadros (workspaces) do usuário — os que ele possui e os que participa. */
export function useWorkspaces() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => notesService.listWorkspaces(),
    staleTime: 60_000,
  })
}

/** Membros de um quadro (habilitado só com id). */
export function useWorkspaceMembers(id: string | null) {
  return useQuery({
    queryKey: membersKey(id ?? ''),
    queryFn: () => notesService.listWorkspaceMembers(id as string),
    enabled: !!id,
    staleTime: 30_000,
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      notesService.createWorkspace(name, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; color?: string } }) =>
      notesService.updateWorkspace(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notesService.deleteWorkspace(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['reminders'] }) // notas voltam a ser pessoais
    },
  })
}

export function useAddWorkspaceMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) =>
      notesService.addWorkspaceMember(id, email),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: membersKey(id) })
      qc.invalidateQueries({ queryKey: KEY }) // memberCount
    },
  })
}

export function useRemoveWorkspaceMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      notesService.removeWorkspaceMember(id, userId),
    onSuccess: (_r, { id }) => {
      qc.invalidateQueries({ queryKey: membersKey(id) })
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useLeaveWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notesService.leaveWorkspace(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['reminders'] })
    },
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'

const key = (noteId: string) => ['comments', noteId] as const

/** Comentários de um lembrete (habilitado só com id). */
export function useComments(noteId: string | null) {
  return useQuery({
    queryKey: key(noteId ?? ''),
    queryFn: () => notesService.listComments(noteId as string),
    enabled: !!noteId,
    staleTime: 15_000,
  })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) =>
      notesService.addComment(noteId, body),
    onSuccess: (_c, { noteId }) => qc.invalidateQueries({ queryKey: key(noteId) }),
  })
}

export function useDeleteComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; noteId: string }) => notesService.deleteComment(id),
    onSuccess: (_r, { noteId }) => qc.invalidateQueries({ queryKey: key(noteId) }),
  })
}

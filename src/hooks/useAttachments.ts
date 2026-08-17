import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'

const key = (noteId: string) => ['attachments', noteId] as const

/** Anexos de um lembrete (habilitado só com id). */
export function useAttachments(noteId: string | null) {
  return useQuery({
    queryKey: key(noteId ?? ''),
    queryFn: () => notesService.listAttachments(noteId as string),
    enabled: !!noteId,
    staleTime: 30_000,
  })
}

export function useAddAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, file }: { noteId: string; file: File }) =>
      notesService.addAttachment(noteId, file),
    onSuccess: (_a, { noteId }) => qc.invalidateQueries({ queryKey: key(noteId) }),
  })
}

export function useDeleteAttachment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; noteId: string }) => notesService.deleteAttachment(id),
    onSuccess: (_r, { noteId }) => qc.invalidateQueries({ queryKey: key(noteId) }),
  })
}

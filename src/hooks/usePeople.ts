import { useQuery } from '@tanstack/react-query'
import { notesService } from '@/services/notesService'

export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: () => notesService.listPeople(),
    staleTime: 60_000,
  })
}

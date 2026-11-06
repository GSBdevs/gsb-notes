import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { stickerService } from '@/services/stickerService'
import { useAppStore } from '@/store/useAppStore'
import type { Sticker } from '@/types'

const STICKERS_KEY = ['stickers'] as const
const PACKS_KEY = ['sticker-packs'] as const

export function useStickers(enabled = true) {
  const authed = useAppStore((s) => s.authed)
  return useQuery({
    queryKey: STICKERS_KEY,
    queryFn: () => stickerService.listStickers(),
    enabled: authed && enabled,
    staleTime: 60_000,
  })
}

export function useStickerPacks(enabled = true) {
  const authed = useAppStore((s) => s.authed)
  return useQuery({
    queryKey: PACKS_KEY,
    queryFn: () => stickerService.listPacks(),
    enabled: authed && enabled,
    staleTime: 60_000,
  })
}

export function useAddSticker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, packId }: { file: File; packId?: string | null }) =>
      stickerService.addSticker(file, packId ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: STICKERS_KEY }),
  })
}

/** Salva na minha biblioteca uma figurinha recebida de outro usuário. */
export function useSaveExternalSticker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (url: string) => stickerService.saveExternalSticker(url),
    onSuccess: () => qc.invalidateQueries({ queryKey: STICKERS_KEY }),
  })
}

export function useDeleteSticker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sticker: Pick<Sticker, 'id' | 'path'>) => stickerService.deleteSticker(sticker),
    onSuccess: () => qc.invalidateQueries({ queryKey: STICKERS_KEY }),
  })
}

export function useCreateStickerPack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => stickerService.createPack(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: PACKS_KEY }),
  })
}

/** Marca uso (recentes). Best-effort; atualiza a lista silenciosamente. */
export function useMarkStickerUsed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => stickerService.markUsed(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: STICKERS_KEY }),
  })
}

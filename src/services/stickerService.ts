import type { Sticker, StickerPack } from '@/types'
import { hasSupabase, supabase } from './supabase'

/**
 * Figurinhas (migração 0025). Cada usuário sobe as próprias imagens para o bucket público 'stickers'
 * (escrita isolada por pasta = auth.uid()) e as envia nas DMs. A UI nunca fala com o Supabase direto.
 */
export interface StickerService {
  listStickers(): Promise<Sticker[]>
  listPacks(): Promise<StickerPack[]>
  createPack(name: string): Promise<StickerPack>
  /** Sobe uma imagem como figurinha (opcionalmente num pacote) e devolve a figurinha criada. */
  addSticker(file: File, packId?: string | null): Promise<Sticker>
  /** Salva na MINHA biblioteca uma figurinha recebida de outro usuário (copia a imagem). */
  saveExternalSticker(url: string): Promise<Sticker>
  deleteSticker(sticker: { id: string; path: string }): Promise<void>
  /** Marca a figurinha como usada agora (alimenta a aba "recentes"). Best-effort. */
  markUsed(id: string): Promise<void>
}

const BUCKET = 'stickers'
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
}

interface StickerRow {
  id: string
  pack_id: string | null
  path: string
  last_used_at: string | null
}
interface PackRow {
  id: string
  name: string
}

class SupabaseStickerService implements StickerService {
  private sb() {
    if (!supabase) throw new Error('Supabase não configurado.')
    return supabase
  }
  private async uid(): Promise<string> {
    const { data } = await this.sb().auth.getUser()
    const id = data.user?.id
    if (!id) throw new Error('Sem sessão.')
    return id
  }
  private urlOf(path: string): string {
    return this.sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl
  }

  async listStickers(): Promise<Sticker[]> {
    const { data, error } = await this.sb()
      .from('stickers')
      .select('id, pack_id, path, last_used_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    return ((data ?? []) as StickerRow[]).map((r) => ({
      id: r.id,
      url: this.urlOf(r.path),
      path: r.path,
      packId: r.pack_id,
      lastUsedAt: r.last_used_at,
    }))
  }

  async listPacks(): Promise<StickerPack[]> {
    const { data, error } = await this.sb()
      .from('sticker_packs')
      .select('id, name')
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((data ?? []) as PackRow[]).map((r) => ({ id: r.id, name: r.name }))
  }

  async createPack(name: string): Promise<StickerPack> {
    const owner_id = await this.uid()
    const { data, error } = await this.sb()
      .from('sticker_packs')
      .insert({ owner_id, name: name.trim() || 'Meu pacote' })
      .select('id, name')
      .single()
    if (error) throw error
    return { id: (data as PackRow).id, name: (data as PackRow).name }
  }

  async addSticker(file: File, packId: string | null = null): Promise<Sticker> {
    const owner_id = await this.uid()
    const ext = EXT[file.type] ?? 'png'
    const id = crypto.randomUUID()
    const path = `${owner_id}/${id}.${ext}`
    const { error: upErr } = await this.sb()
      .storage.from(BUCKET)
      .upload(path, file, { contentType: file.type || 'image/png', upsert: false })
    if (upErr) throw upErr
    const { error } = await this.sb()
      .from('stickers')
      .insert({ id, owner_id, pack_id: packId, path, mime: file.type || 'image/png' })
    if (error) {
      // rollback do arquivo se a linha não gravou
      await this.sb().storage.from(BUCKET).remove([path])
      throw error
    }
    return { id, url: this.urlOf(path), path, packId, lastUsedAt: null }
  }

  async saveExternalSticker(url: string): Promise<Sticker> {
    // Baixa a imagem (o bucket é público) e re-sobe na MINHA pasta — fica independente do remetente.
    const res = await fetch(url)
    if (!res.ok) throw new Error('Não foi possível baixar a figurinha.')
    const blob = await res.blob()
    const type = blob.type || 'image/png'
    const ext = EXT[type] ?? 'png'
    const file = new File([blob], `sticker.${ext}`, { type })
    return this.addSticker(file, null)
  }

  async deleteSticker(sticker: { id: string; path: string }): Promise<void> {
    const { error } = await this.sb().from('stickers').delete().eq('id', sticker.id)
    if (error) throw error
    await this.sb().storage.from(BUCKET).remove([sticker.path])
  }

  async markUsed(id: string): Promise<void> {
    await this.sb().from('stickers').update({ last_used_at: new Date().toISOString() }).eq('id', id)
  }
}

/** Mock (sem backend): sem figurinhas. */
class MockStickerService implements StickerService {
  async listStickers(): Promise<Sticker[]> {
    return []
  }
  async listPacks(): Promise<StickerPack[]> {
    return []
  }
  async createPack(name: string): Promise<StickerPack> {
    return { id: 'mock', name }
  }
  async addSticker(): Promise<Sticker> {
    throw new Error('Figurinhas exigem o backend configurado.')
  }
  async saveExternalSticker(): Promise<Sticker> {
    throw new Error('Figurinhas exigem o backend configurado.')
  }
  async deleteSticker(): Promise<void> {}
  async markUsed(): Promise<void> {}
}

export const stickerService: StickerService = hasSupabase
  ? new SupabaseStickerService()
  : new MockStickerService()

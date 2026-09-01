import { supabase } from './supabase'

const AVATAR_BUCKET = 'avatars'

/**
 * Perfil do usuário logado (nome + cor + foto do avatar). A UI edita no ProfileSheet; aqui a
 * mudança é GRAVADA na tabela `profiles` do Supabase e a foto vai para o Storage.
 *
 * Sem isto, o nome/cor só iam para o store local (zustand/persist) e, no próximo login, o
 * `useAuthSession` re-hidratava do banco por cima. Sem Supabase (.env vazio), é no-op.
 */
export const profileService = {
  async update(patch: { name?: string; color?: string; avatarUrl?: string | null }): Promise<void> {
    if (!supabase) return
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    const fields: Record<string, string | null> = {}
    if (patch.name !== undefined) fields.display_name = patch.name
    if (patch.color !== undefined) fields.avatar_color = patch.color
    if (patch.avatarUrl !== undefined) fields.avatar_url = patch.avatarUrl // pode ser null (remover foto)
    if (Object.keys(fields).length === 0) return
    const { error } = await supabase.from('profiles').update(fields).eq('id', data.user.id)
    if (error) throw error
  },

  /**
   * Sobe a foto de perfil ao Storage (bucket público `avatars`) e devolve a URL pública.
   * Usa um caminho fixo por usuário (sobrescreve a anterior — sem órfãos) + cache-bust `?v=`.
   */
  async uploadAvatar(file: File): Promise<string> {
    if (!supabase) throw new Error('Backend não configurado.')
    const { data } = await supabase.auth.getUser()
    if (!data.user) throw new Error('Sem sessão ativa.')
    const path = `${data.user.id}/avatar`
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || undefined })
    if (error) throw error
    const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    return `${pub.publicUrl}?v=${Date.now()}`
  },
}

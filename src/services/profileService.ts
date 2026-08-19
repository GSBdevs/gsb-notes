import { supabase } from './supabase'

/**
 * Perfil do usuário logado (nome + cor do avatar). A UI edita no ProfileSheet; aqui a mudança
 * é GRAVADA na tabela `profiles` do Supabase.
 *
 * Sem isto, o nome/cor só iam para o store local (zustand/persist) e, no próximo login, o
 * `useAuthSession` re-hidratava do banco por cima — voltando a cor para o padrão (âmbar).
 * Sem Supabase (.env vazio), é no-op: o modo mock guarda tudo no store local mesmo.
 */
export const profileService = {
  async update(patch: { name?: string; color?: string }): Promise<void> {
    if (!supabase) return
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    const fields: Record<string, string> = {}
    if (patch.name !== undefined) fields.display_name = patch.name
    if (patch.color !== undefined) fields.avatar_color = patch.color
    if (Object.keys(fields).length === 0) return
    const { error } = await supabase.from('profiles').update(fields).eq('id', data.user.id)
    if (error) throw error
  },
}

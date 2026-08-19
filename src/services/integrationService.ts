import { supabase } from './supabase'

/**
 * Integrações (Fase 4 — webhooks). A URL fica em profiles.webhook_url (migração 0013);
 * quem dispara os POSTs é um gatilho no banco (pg_net) quando um lembrete do usuário é
 * criado/concluído/disparado. Sem Supabase (mock), fica indisponível.
 */
export const integrationService = {
  available: !!supabase,

  async getWebhookUrl(): Promise<string> {
    if (!supabase) return ''
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return ''
    const { data } = await supabase.from('profiles').select('webhook_url').eq('id', user.id).single()
    return ((data as { webhook_url: string | null } | null)?.webhook_url ?? '') as string
  },

  async setWebhookUrl(url: string): Promise<void> {
    if (!supabase) throw new Error('Supabase não configurado.')
    const trimmed = url.trim()
    if (trimmed && !/^https:\/\//i.test(trimmed)) throw new Error('A URL precisa começar com https://')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Sem sessão ativa.')
    const { error } = await supabase
      .from('profiles')
      .update({ webhook_url: trimmed || null })
      .eq('id', user.id)
    if (error) throw error
  },
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase. Fica `null` enquanto as variáveis de ambiente não estão preenchidas
 * (ver .env.example) — nesse caso o app roda 100% com o serviço mock em memória.
 *
 * Aceita a nova chave publishable do Supabase (`sb_publishable_...`) e, como fallback,
 * a chave legada `anon`. Ambas são públicas — a segurança vem da RLS no banco.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const hasSupabase = supabase !== null

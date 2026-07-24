import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase. Fica `null` enquanto as variáveis de ambiente não estão preenchidas
 * (ver .env.example) — nesse caso o app roda 100% com o serviço mock em memória.
 * Na Fase 2, preencha o .env e implemente supabaseNotesService (services/notesService.ts).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const hasSupabase = supabase !== null

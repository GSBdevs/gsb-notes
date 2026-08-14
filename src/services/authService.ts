import { supabase } from './supabase'

/** Resultado padrão das ações de auth: `error` nulo = sucesso. */
export interface AuthResult {
  error: string | null
  /** Sinaliza que o cadastro exige confirmação por e-mail (sem sessão imediata). */
  needsEmailConfirm?: boolean
}

const NO_BACKEND: AuthResult = { error: 'Supabase não configurado.' }

/**
 * Camada de autenticação (Supabase Auth). A UI nunca chama supabase.auth direto.
 * Em modo mock (sem .env), estas funções não são usadas — a AuthScreen usa o login local.
 */
export const authService = {
  async signUp(email: string, password: string, displayName?: string): Promise<AuthResult> {
    if (!supabase) return NO_BACKEND
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName?.trim() || email.split('@')[0] } },
    })
    if (error) return { error: error.message }
    // Com "Confirm email" ligado, não há sessão até o usuário confirmar por e-mail.
    return { error: null, needsEmailConfirm: !data.session }
  },

  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return NO_BACKEND
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  },

  async signInWithMagicLink(email: string): Promise<AuthResult> {
    if (!supabase) return NO_BACKEND
    const { error } = await supabase.auth.signInWithOtp({ email })
    return { error: error?.message ?? null }
  },

  async signOut(): Promise<void> {
    await supabase?.auth.signOut()
  },
}

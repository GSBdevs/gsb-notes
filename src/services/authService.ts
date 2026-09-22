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

  /**
   * Envia o e-mail de recuperação. Com o template configurado para mostrar o CÓDIGO (`{{ .Token }}`),
   * o usuário recebe um código de 6 dígitos e redefine a senha DENTRO do app (sem link/site) — ver
   * `verifyRecoveryCode`. O `redirectTo` só é usado se o template ainda tiver link (fluxo web).
   */
  async sendPasswordReset(email: string): Promise<AuthResult> {
    if (!supabase) return NO_BACKEND
    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    return { error: error?.message ?? null }
  },

  /**
   * Fluxo de recuperação POR CÓDIGO (sem link/site — ideal para o app desktop/nativo). Valida o
   * código de 6 dígitos (cria sessão via `verifyOtp` type 'recovery' → emite SIGNED_IN) e já grava a
   * nova senha. Ao final, o usuário fica logado com a senha nova.
   */
  async verifyRecoveryCode(email: string, code: string, newPassword: string): Promise<AuthResult> {
    if (!supabase) return NO_BACKEND
    const { error: vErr } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })
    if (vErr) return { error: vErr.message }
    const { error: uErr } = await supabase.auth.updateUser({ password: newPassword })
    return { error: uErr?.message ?? null }
  },

  /** Define uma nova senha para a sessão atual (usada no fluxo de recuperação por link). */
  async updatePassword(newPassword: string): Promise<AuthResult> {
    if (!supabase) return NO_BACKEND
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error?.message ?? null }
  },

  async signOut(): Promise<void> {
    await supabase?.auth.signOut()
  },
}

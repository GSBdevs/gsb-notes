import { supabase } from './supabase'

/** Resultado padrão das ações de auth: `error` nulo = sucesso. */
export interface AuthResult {
  error: string | null
}

const NO_BACKEND: AuthResult = { error: 'Supabase não configurado.' }

/** Traduz as mensagens do Supabase Auth que o usuário pode encontrar. */
function friendlyError(message: string): string {
  if (/banned/i.test(message)) return 'Este acesso foi bloqueado. Fale com o administrador.'
  if (/invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.'
  if (/different from the old password/i.test(message)) return 'Escolha uma senha diferente da atual.'
  return message
}

/**
 * Camada de autenticação (Supabase Auth). A UI nunca chama supabase.auth direto.
 * Em modo mock (sem .env), estas funções não são usadas — a AuthScreen usa o login local.
 */
export const authService = {
  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!supabase) return NO_BACKEND
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? friendlyError(error.message) : null }
  },

  /** Troca a senha do próprio usuário e encerra a exigência de troca no 1º acesso. */
  async changeOwnPassword(password: string): Promise<AuthResult> {
    if (!supabase) return NO_BACKEND
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    })
    return { error: error ? friendlyError(error.message) : null }
  },

  async signOut(): Promise<void> {
    await supabase?.auth.signOut()
  },
}

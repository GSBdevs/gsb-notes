import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { authService } from '@/services/authService'
import { hasSupabase } from '@/services/supabase'
import { Icon } from '@/components/ui/Icon'

/**
 * Troca de senha obrigatória (doc 22): cobre o app inteiro enquanto a conta usa uma senha definida
 * pelo master, seja no 1º acesso ou depois de uma redefinição.
 */
export function ChangePasswordScreen() {
  const setMustChangePassword = useAppStore((s) => s.setMustChangePassword)
  const logout = useAppStore((s) => s.logout)
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (password.length < 6) {
      setError('A senha precisa de ao menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não são iguais.')
      return
    }

    // Modo mock (sem .env): só libera a tela.
    if (hasSupabase) {
      setBusy(true)
      const res = await authService.changeOwnPassword(password)
      setBusy(false)
      if (res.error) {
        setError(res.error)
        return
      }
    }
    setMustChangePassword(false)
  }

  const onLogout = async () => {
    if (hasSupabase) await authService.signOut() // a sessão real dispara setAuthed(false)
    else logout()
    navigate('/login')
  }

  const field =
    'mb-4 h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent'

  return (
    <div
      className="safe-shell fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(250,204,21,.06), transparent 60%), var(--bg-base)',
      }}
    >
      <div className="w-full max-w-[400px] animate-fadeUp">
        <div className="rounded-lg border border-border bg-bg-elevated p-7 shadow-card">
          <h1 className="mb-1 text-[22px] font-bold tracking-[-.02em]">Crie sua senha</h1>
          <p className="mb-[22px] text-sm text-text-secondary">
            Esta senha foi definida pelo administrador. Escolha uma só sua para continuar.
          </p>

          <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">Nova senha</label>
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mín. 6 caracteres"
            className={field}
          />

          <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">Confirme a senha</label>
          <input
            type="password"
            value={confirm}
            autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
            className={field}
          />

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-[#ef444480] bg-[#ef44441a] px-3 py-2.5 text-[13px] font-medium text-danger">
              <Icon name="alert-triangle" size={15} className="mt-px flex-none" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="flex h-[46px] w-full items-center justify-center gap-2 rounded-md bg-accent text-[15px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            {busy && <Icon name="loader-2" size={16} className="animate-spin" />}
            {busy ? 'Aguarde…' : 'Salvar e continuar'}
          </button>
        </div>

        <p className="mt-[18px] text-center text-[13px] text-text-muted">
          <button onClick={onLogout} className="font-semibold text-accent-ink hover:text-accent-hover">
            Sair
          </button>
        </p>
      </div>
    </div>
  )
}

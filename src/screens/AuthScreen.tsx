import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { authService } from '@/services/authService'
import { hasSupabase } from '@/services/supabase'
import { Icon } from '@/components/ui/Icon'

export function AuthScreen() {
  const login = useAppStore((s) => s.login)
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)

    // Modo mock (sem .env): login local, como na Fase 1.
    if (!hasSupabase) {
      login()
      navigate('/')
      return
    }

    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha.')
      return
    }

    setBusy(true)
    const res = await authService.signIn(email.trim(), password)
    setBusy(false)

    if (res.error) {
      setError(res.error)
      return
    }
    navigate('/') // sessão ativa → a sessão real também dirige o roteamento
  }

  return (
    <div
      className="safe-shell flex min-h-screen items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(250,204,21,.06), transparent 60%), var(--bg-base)',
      }}
    >
      <div className="w-full max-w-[400px] animate-fadeUp">
        <div className="mb-7 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-accent text-text-on-accent">
            <Icon name="bell" size={20} />
          </span>
          <span className="text-xl font-bold tracking-[-.01em]">SB Notas</span>
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-7 shadow-card">
          <h1 className="mb-1 text-[22px] font-bold tracking-[-.02em]">Bem-vindo de volta</h1>
          <p className="mb-[22px] text-sm text-text-secondary">Entre para ver seus lembretes.</p>

          <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">E-mail</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            className="mb-4 h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
          />

          <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">Senha</label>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
            placeholder="••••••••"
            className="mb-4 h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
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
            {busy ? 'Aguarde…' : 'Entrar'}
          </button>
        </div>

        <p className="mt-[18px] text-center text-[13px] text-text-muted">
          O acesso é criado pelo administrador.
        </p>
      </div>
    </div>
  )
}

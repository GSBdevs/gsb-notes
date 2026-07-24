import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@/components/ui/Icon'

export function AuthScreen() {
  const login = useAppStore((s) => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = useState('voce@exemplo.com')
  const [password, setPassword] = useState('123456')

  const enter = () => {
    // Fase 1: auth mockada. Fase 2: authService.signIn (Supabase Auth).
    login()
    navigate('/')
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
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
            className="mb-4 h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
          />

          <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-5 h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
          />

          <button
            onClick={enter}
            className="h-[46px] w-full rounded-md bg-accent text-[15px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
          >
            Entrar
          </button>
          <button
            onClick={enter}
            className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-transparent text-sm font-medium text-text-primary transition-colors hover:border-border-strong"
          >
            <Icon name="sparkles" size={16} /> Enviar magic link
          </button>
        </div>
        <p className="mt-[18px] text-center text-[13px] text-text-muted">
          Não tem conta?{' '}
          <button onClick={enter} className="text-accent hover:text-accent-hover">
            Cadastre-se
          </button>
        </p>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { authService } from '@/services/authService'
import { hasSupabase } from '@/services/supabase'
import { Icon } from '@/components/ui/Icon'

type Mode = 'signin' | 'signup'

export function AuthScreen() {
  const login = useAppStore((s) => s.login)
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const isSignup = mode === 'signup'

  const submit = async () => {
    setError(null)
    setInfo(null)

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
    const res = isSignup
      ? await authService.signUp(email.trim(), password, name)
      : await authService.signIn(email.trim(), password)
    setBusy(false)

    if (res.error) {
      setError(res.error)
      return
    }
    if (res.needsEmailConfirm) {
      setInfo('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.')
      setMode('signin')
      return
    }
    navigate('/') // sessão ativa → a sessão real também dirige o roteamento
  }

  const magicLink = async () => {
    setError(null)
    setInfo(null)
    if (!hasSupabase) {
      login()
      navigate('/')
      return
    }
    if (!email.trim()) {
      setError('Informe seu e-mail para o magic link.')
      return
    }
    setBusy(true)
    const res = await authService.signInWithMagicLink(email.trim())
    setBusy(false)
    if (res.error) setError(res.error)
    else setInfo('Link de acesso enviado. Verifique seu e-mail.')
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
          <h1 className="mb-1 text-[22px] font-bold tracking-[-.02em]">
            {isSignup ? 'Criar conta' : 'Bem-vindo de volta'}
          </h1>
          <p className="mb-[22px] text-sm text-text-secondary">
            {isSignup ? 'Comece a criar seus lembretes.' : 'Entre para ver seus lembretes.'}
          </p>

          {isSignup && (
            <>
              <label className="mb-1.5 block text-[13px] font-medium text-text-secondary">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como você aparece para os outros"
                className="mb-4 h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
              />
            </>
          )}

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
            autoComplete={isSignup ? 'new-password' : 'current-password'}
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
          {info && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-border-strong bg-bg-base px-3 py-2.5 text-[13px] font-medium text-text-secondary">
              <Icon name="check-circle" size={15} className="mt-px flex-none" style={{ color: 'var(--success)' }} />
              <span>{info}</span>
            </div>
          )}

          <button
            onClick={submit}
            disabled={busy}
            className="flex h-[46px] w-full items-center justify-center gap-2 rounded-md bg-accent text-[15px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            {busy && <Icon name="loader-2" size={16} className="animate-spin" />}
            {busy ? 'Aguarde…' : isSignup ? 'Criar conta' : 'Entrar'}
          </button>
          <button
            onClick={magicLink}
            disabled={busy}
            className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border bg-transparent text-sm font-medium text-text-primary transition-colors hover:border-border-strong disabled:opacity-70"
          >
            <Icon name="sparkles" size={16} /> Enviar magic link
          </button>
        </div>
        <p className="mt-[18px] text-center text-[13px] text-text-muted">
          {isSignup ? 'Já tem conta? ' : 'Não tem conta? '}
          <button
            onClick={() => {
              setMode(isSignup ? 'signin' : 'signup')
              setError(null)
              setInfo(null)
            }}
            className="font-semibold text-accent hover:text-accent-hover"
          >
            {isSignup ? 'Entrar' : 'Cadastre-se'}
          </button>
        </p>
      </div>
    </div>
  )
}

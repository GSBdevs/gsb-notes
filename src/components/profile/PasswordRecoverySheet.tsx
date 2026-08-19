import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { authService } from '@/services/authService'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

/**
 * Definir nova senha (fluxo de recuperação). Aparece quando o Supabase dispara PASSWORD_RECOVERY
 * — ou seja, quando o usuário abre o link de recuperação enviado por e-mail. A sessão de
 * recuperação já está ativa; aqui só gravamos a nova senha.
 */
export function PasswordRecoverySheet() {
  const recovering = useAppStore((s) => s.recovering)
  const setRecovering = useAppStore((s) => s.setRecovering)
  const showToast = useAppStore((s) => s.showToast)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!recovering) return null

  const submit = async () => {
    setError(null)
    if (password.length < 6) {
      setError('A senha precisa ter ao menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.')
      return
    }
    setBusy(true)
    const res = await authService.updatePassword(password)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setRecovering(false)
    showToast('Senha atualizada')
  }

  return (
    <Modal
      title="Definir nova senha"
      onClose={() => setRecovering(false)}
      footer={
        <>
          <div className="flex-1" />
          <button
            onClick={submit}
            disabled={busy}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            {busy && <Icon name="loader-2" size={16} className="animate-spin" />}
            {busy ? 'Salvando…' : 'Salvar senha'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <p className="text-[13.5px] text-text-secondary">
          Escolha uma nova senha para a sua conta. Depois de salvar, você já entra normalmente.
        </p>

        <div>
          <label htmlFor="rec-pass" className="mb-1.5 block text-[13px] font-medium text-text-secondary">
            Nova senha
          </label>
          <input
            id="rec-pass"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>

        <div>
          <label htmlFor="rec-confirm" className="mb-1.5 block text-[13px] font-medium text-text-secondary">
            Confirmar senha
          </label>
          <input
            id="rec-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && submit()}
            placeholder="••••••••"
            className="h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-[#ef444480] bg-[#ef44441a] px-3 py-2.5 text-[13px] font-medium text-danger">
            <Icon name="alert-triangle" size={15} className="mt-px flex-none" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

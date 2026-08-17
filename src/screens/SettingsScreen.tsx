import { useEffect } from 'react'
import type { Settings } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { platform } from '@/platform'
import { disablePush, enablePush, isPushEnabled, pushConfigured } from '@/services/pushService'
import { Toggle } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'

interface Row {
  icon: string
  label: string
  desc: string
  key: keyof Settings
  /** Só faz sentido no desktop (Tauri); na web o toggle aparece desabilitado. */
  desktopOnly?: boolean
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Sistema',
    rows: [
      { icon: 'power', label: 'Iniciar com o Windows', desc: 'Abre o SB Notas minimizado na bandeja ao ligar o PC', key: 'autostart', desktopOnly: true },
    ],
  },
  {
    title: 'Notificações & permissões',
    rows: [
      { icon: 'alarm-clock', label: 'Alarme na hora do lembrete', desc: 'Som e overlay quando um lembrete dispara', key: 'alarm' },
      { icon: 'pin', label: 'Janela sempre no topo (Windows)', desc: 'O overlay aparece por cima de tudo', key: 'ontop', desktopOnly: true },
      { icon: 'volume-2', label: 'Som de disparo', desc: 'Toca um alerta curto ao disparar', key: 'sound' },
      { icon: 'bell-ring', label: 'Notificações push (app fechado)', desc: 'Recebe o lembrete mesmo com o app fechado (PWA)', key: 'push' },
    ],
  },
  {
    title: 'Compartilhamento',
    rows: [
      { icon: 'eye', label: 'Mostrar presença', desc: 'Deixa outras pessoas verem quando você está online', key: 'presence' },
    ],
  },
  {
    title: 'Aparência & acessibilidade',
    rows: [
      { icon: 'sparkles', label: 'Reduzir movimento', desc: 'Desliga pulso e shake no disparo', key: 'reduce' },
    ],
  },
]

export function SettingsScreen() {
  const settings = useAppStore((s) => s.settings)
  const toggleSetting = useAppStore((s) => s.toggleSetting)
  const setSetting = useAppStore((s) => s.setSetting)
  const showToast = useAppStore((s) => s.showToast)
  const isWeb = platform.kind === 'web'
  const pushReady = pushConfigured()

  // O SO é a fonte da verdade do autostart: ao abrir, alinha o toggle ao estado real.
  useEffect(() => {
    platform.isAutostartEnabled().then((on) => setSetting('autostart', on))
  }, [setSetting])

  // O navegador é a fonte da verdade do push: alinha o toggle à inscrição real.
  useEffect(() => {
    if (!pushReady) return
    isPushEnabled()
      .then((on) => setSetting('push', on))
      .catch(() => {})
  }, [pushReady, setSetting])

  const handleToggle = async (key: keyof Settings) => {
    if (key === 'autostart') {
      const next = !settings.autostart
      await platform.setAutostart(next) // aplica no SO primeiro…
      setSetting('autostart', next) // …e reflete o estado real no toggle
      return
    }
    if (key === 'push') {
      const next = !settings.push
      try {
        if (next) await enablePush()
        else await disablePush()
        setSetting('push', next) // reflete a inscrição real
        showToast(next ? 'Notificações push ativadas' : 'Notificações push desativadas')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Não foi possível alterar as notificações')
      }
      return
    }
    toggleSetting(key)
  }

  return (
    <div className="flex max-w-[640px] flex-col gap-3.5">
      {GROUPS.map((g) => (
        <div key={g.title} className="overflow-hidden rounded-md border border-border bg-bg-elevated">
          <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
            {g.title}
          </div>
          {g.rows.map((r) => {
            const locked = r.key === 'push' ? !pushReady : !!r.desktopOnly && isWeb
            const lockedNote =
              r.key === 'push' ? 'requer HTTPS + chave VAPID' : 'disponível no app de desktop'
            return (
              <div key={r.key} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
                <Icon name={r.icon} size={18} style={{ color: 'var(--text-secondary)' }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{r.label}</div>
                  <div className="text-[12.5px] text-text-muted">
                    {locked ? `${r.desc} · ${lockedNote}` : r.desc}
                  </div>
                </div>
                <Toggle
                  checked={settings[r.key]}
                  disabled={locked}
                  onChange={() => handleToggle(r.key)}
                />
              </div>
            )
          })}
        </div>
      ))}

      {/* Atalho global (só existe na casca desktop/Tauri). */}
      {!isWeb && (
        <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
          <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
            Atalhos
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Icon name="zap" size={18} style={{ color: 'var(--text-secondary)' }} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Abrir de qualquer lugar</div>
              <div className="text-[12.5px] text-text-muted">
                Traz o SB Notas à frente — ou esconde, se já estiver em foco
              </div>
            </div>
            <kbd className="flex-none rounded border border-border bg-bg-base px-2 py-1 text-xs font-semibold text-text-secondary">
              Ctrl + Shift + S
            </kbd>
          </div>
        </div>
      )}
    </div>
  )
}

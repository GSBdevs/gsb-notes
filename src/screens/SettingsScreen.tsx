import { useEffect } from 'react'
import type { Settings } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { platform } from '@/platform'
import { disablePush, enablePush, isPushEnabled, pushConfigured } from '@/services/pushService'
import { CARD_COLORS, SNOOZE_INTERVALS } from '@/lib/constants'
import { Toggle } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'

/** Chaves booleanas dos Ajustes (accent/scale/theme/snoozeInterval têm UI própria). */
type BoolSettingKey = Exclude<keyof Settings, 'accent' | 'scale' | 'theme' | 'snoozeInterval'>

interface Row {
  icon: string
  label: string
  desc: string
  key: BoolSettingKey
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
      { icon: 'repeat', label: 'Insistir até concluir (auto-snooze)', desc: 'Padrão de novos lembretes: o disparo reaparece até você concluir ou reagendar', key: 'autoSnooze' },
    ],
  },
  {
    title: 'Aparência & acessibilidade',
    rows: [
      { icon: 'sparkles', label: 'Reduzir movimento', desc: 'Desliga pulso e shake no disparo', key: 'reduce' },
    ],
  },
]

/** Presets de escala da interface (zoom). */
const SCALES: { label: string; value: number }[] = [
  { label: 'Compacto', value: 0.9 },
  { label: 'Padrão', value: 1 },
  { label: 'Confortável', value: 1.1 },
  { label: 'Grande', value: 1.25 },
]

/** Opções de tema. */
const THEMES: { label: string; value: 'dark' | 'light' | 'system'; icon: string }[] = [
  { label: 'Escuro', value: 'dark', icon: 'moon' },
  { label: 'Claro', value: 'light', icon: 'sun' },
  { label: 'Sistema', value: 'system', icon: 'monitor' },
]

export function SettingsScreen() {
  const settings = useAppStore((s) => s.settings)
  const toggleSetting = useAppStore((s) => s.toggleSetting)
  const setSetting = useAppStore((s) => s.setSetting)
  const setAccent = useAppStore((s) => s.setAccent)
  const setScale = useAppStore((s) => s.setScale)
  const setSnoozeInterval = useAppStore((s) => s.setSnoozeInterval)
  const setTheme = useAppStore((s) => s.setTheme)
  const showToast = useAppStore((s) => s.showToast)
  const theme = settings.theme ?? 'dark'
  // Recursos desktop-only (autostart, sempre-no-topo, atalho global) valem só na casca Tauri.
  const isDesktop = platform.kind === 'tauri'
  const pushReady = pushConfigured()
  const scale = settings.scale ?? 1
  const snoozeInterval = settings.snoozeInterval ?? 10

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

  const handleToggle = async (key: BoolSettingKey) => {
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
    <div className="mx-auto flex max-w-[760px] flex-col gap-3.5">
      {GROUPS.map((g) => (
        <div key={g.title} className="overflow-hidden rounded-md border border-border bg-bg-elevated">
          <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
            {g.title}
          </div>
          {g.rows.map((r) => {
            const locked = r.key === 'push' ? !pushReady : !!r.desktopOnly && !isDesktop
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

      {/* Intervalo padrão do auto-snooze */}
      <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
        <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
          Insistência (auto-snooze)
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <Icon name="repeat" size={18} style={{ color: 'var(--text-secondary)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Reaparecer a cada</div>
            <div className="text-[12.5px] text-text-muted">
              Intervalo padrão entre as re-tentativas · para após 5 tentativas
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SNOOZE_INTERVALS.map((s) => {
              const on = snoozeInterval === s.min
              return (
                <button
                  key={s.min}
                  onClick={() => setSnoozeInterval(s.min)}
                  aria-pressed={on}
                  className={`h-9 rounded-md border px-3 text-[13px] font-semibold transition-colors ${
                    on
                      ? 'border-accent bg-accent-surface text-accent-ink'
                      : 'border-border bg-bg-base text-text-secondary hover:border-border-strong'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tema (claro / escuro / sistema) */}
      <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
        <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
          Tema
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <Icon name="moon" size={18} style={{ color: 'var(--text-secondary)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Aparência</div>
            <div className="text-[12.5px] text-text-muted">Claro, escuro, ou seguindo o sistema</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {THEMES.map((t) => {
              const on = theme === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  aria-pressed={on}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition-colors ${
                    on
                      ? 'border-accent bg-accent-surface text-accent-ink'
                      : 'border-border bg-bg-base text-text-secondary hover:border-border-strong'
                  }`}
                >
                  <Icon name={t.icon} size={14} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tamanho da interface (zoom) */}
      <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
        <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
          Tamanho da interface
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <Icon name="maximize-2" size={18} style={{ color: 'var(--text-secondary)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Escala do app</div>
            <div className="text-[12.5px] text-text-muted">
              Deixa tudo maior ou menor — texto, cards e botões
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SCALES.map((s) => {
              const on = Math.abs(scale - s.value) < 0.001
              return (
                <button
                  key={s.value}
                  onClick={() => setScale(s.value)}
                  aria-pressed={on}
                  className={`h-9 rounded-md border px-3 text-[13px] font-semibold transition-colors ${
                    on
                      ? 'border-accent bg-accent-surface text-accent-ink'
                      : 'border-border bg-bg-base text-text-secondary hover:border-border-strong'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Cor de destaque (tema) */}
      <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
        <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
          Cor de destaque
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <Icon name="sparkles" size={18} style={{ color: 'var(--text-secondary)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Tema do app</div>
            <div className="text-[12.5px] text-text-muted">
              Muda a cor de destaque em botões, seleções e no disparo
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {CARD_COLORS.map((c) => {
              const on = settings.accent === c.hex
              return (
                <button
                  key={c.hex}
                  title={c.name}
                  aria-label={`Cor ${c.name}`}
                  aria-pressed={on}
                  onClick={() => setAccent(c.hex)}
                  className="h-7 w-7 rounded-full transition-transform hover:scale-105"
                  style={{
                    background: c.hex,
                    border: `2px solid ${on ? 'var(--text-primary)' : 'transparent'}`,
                    boxShadow: on ? `0 0 0 2px ${c.hex}` : 'none',
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Atalho global (só existe na casca desktop/Tauri). */}
      {isDesktop && (
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

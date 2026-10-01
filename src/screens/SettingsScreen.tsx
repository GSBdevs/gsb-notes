import { useEffect, useState } from 'react'
import type { Settings } from '@/types'
import type { AlarmInfo } from '@/platform/nativeAlarm'
import { useAppStore } from '@/store/useAppStore'
import { platform, type NotificationPermState } from '@/platform'
import { useMyRole } from '@/hooks/useAdmin'
import { disablePush, enablePush, isPushEnabled, pushConfigured } from '@/services/pushService'
import { CARD_COLORS, SNOOZE_INTERVALS } from '@/lib/constants'
import { CURRENT_VERSION } from '@/data/changelog'
import { WHATS_NEW_EVENT } from '@/components/WhatsNewModal'
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

  // Permissão de notificação do SO (Android/desktop): estado real p/ exibir, conceder e testar.
  const [permState, setPermState] = useState<NotificationPermState | null>(null)
  useEffect(() => {
    platform
      .checkNotificationPermission?.()
      .then(setPermState)
      .catch(() => setPermState('unsupported'))
  }, [])

  const requestNotifPerm = async () => {
    const granted = await platform.requestNotificationPermission()
    const st = (await platform.checkNotificationPermission?.()) ?? (granted ? 'granted' : 'denied')
    setPermState(st)
    showToast(
      granted
        ? 'Notificações ativadas'
        : 'Permissão negada — ative em Configurações do Android → Apps → SB Notas → Notificações',
    )
  }

  const testNotif = () => {
    platform.notify('SB Notas', 'Notificação de teste — se você está vendo isto, está funcionando.')
    showToast('Enviei uma notificação de teste')
  }

  // ── Diagnóstico Android ───────────────────────────────────────────────────────────────────
  // Ferramentas de debug (alarme/notificação) que logam no Logcat. Visíveis APENAS para o master
  // (papel oculto dos demais), no app nativo (Capacitor). Web/desktop e usuários comuns não veem.
  const { data: myRole } = useMyRole()
  const showDiag = platform.kind === 'capacitor' && myRole === 'master'
  const [alarmInfo, setAlarmInfo] = useState<AlarmInfo | null>(null)

  const loadAlarmInfo = async () => {
    try {
      const { Alarm } = await import('@/platform/nativeAlarm')
      const info = await Alarm.getInfo()
      setAlarmInfo(info)
      console.log('[SBNotas] getInfo ->', info)
    } catch (e) {
      console.warn('[SBNotas] getInfo ERRO:', e)
      showToast('Plugin de alarme indisponível neste build')
    }
  }

  useEffect(() => {
    if (showDiag) void loadAlarmInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDiag])

  const testScheduledAlarm = async () => {
    try {
      const { Alarm } = await import('@/platform/nativeAlarm')
      await Alarm.schedule({
        id: 987654321,
        at: Date.now() + 15_000,
        title: 'Alarme de teste',
        body: 'Agendado há 15s — bloqueie a tela e aguarde',
      })
      showToast('Alarme agendado p/ daqui a 15s — bloqueie a tela e aguarde')
    } catch (e) {
      console.warn('[SBNotas] testScheduledAlarm ERRO:', e)
      showToast('Falha ao agendar o alarme de teste (ver Logcat)')
    }
  }

  const testFireNow = async () => {
    try {
      const { Alarm } = await import('@/platform/nativeAlarm')
      await Alarm.fireNow({ title: 'Alarme de teste', body: 'Disparo imediato (diagnóstico)' })
      showToast('Disparei o alarme agora — veja se a tela cheia abre')
    } catch (e) {
      console.warn('[SBNotas] fireNow ERRO:', e)
      showToast('Falha ao disparar o alarme (ver Logcat)')
    }
  }

  const openFsSettings = async () => {
    try {
      const { Alarm } = await import('@/platform/nativeAlarm')
      await Alarm.openFullScreenSettings()
    } catch (e) {
      console.warn('[SBNotas] openFullScreenSettings ERRO:', e)
    }
  }

  // Testa a notificação AGENDADA padrão do Capacitor (+20s). Isola "o aparelho entrega agendamento
  // local?" do nosso alarme nativo: se esta dispara e o alarme não, o problema é o nosso receiver.
  const testScheduledNotif = async () => {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 424242,
            title: 'Notificação agendada (teste)',
            body: 'Se apareceu, agendamento local funciona neste aparelho',
            channelId: 'reminders',
            schedule: { at: new Date(Date.now() + 20_000), allowWhileIdle: true },
          },
        ],
      })
      showToast('Notificação agendada p/ 20s — bloqueie a tela e aguarde')
      console.log('[SBNotas] teste: LocalNotification agendada +20s')
    } catch (e) {
      console.warn('[SBNotas] testScheduledNotif ERRO:', e)
      showToast('Falha ao agendar notificação de teste')
    }
  }

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

      {/* Permissão de notificação do dispositivo (conceder + testar) */}
      {permState && permState !== 'unsupported' && (
        <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
          <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
            Notificações do dispositivo
          </div>
          <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <Icon name="bell-ring" size={18} style={{ color: 'var(--text-secondary)' }} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Permissão do sistema</div>
              <div className="text-[12.5px] text-text-muted">
                {permState === 'granted'
                  ? 'Concedida — lembretes e itens fixados podem notificar.'
                  : permState === 'denied'
                    ? 'Bloqueada. Ative em Configurações do Android → Apps → SB Notas → Notificações.'
                    : 'Ainda não concedida — toque em Ativar para o sistema pedir.'}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {permState !== 'granted' && (
                <button
                  onClick={requestNotifPerm}
                  className="h-9 rounded-md bg-accent px-3.5 text-[13px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
                >
                  Ativar
                </button>
              )}
              <button
                onClick={testNotif}
                className="h-9 rounded-md border border-border bg-bg-base px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Testar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagnóstico do Android — visível só para o master (debug) */}
      {showDiag && (
        <div className="overflow-hidden rounded-md border border-amber-500/40 bg-bg-elevated">
          <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
            Diagnóstico (Android) · master
          </div>
          <div className="flex flex-col gap-3 px-4 py-3.5">
            <div className="text-[12.5px] text-text-muted">
              Ferramentas para investigar notificações e alarme via Logcat (Android Studio). Filtre
              pelas tags <code>SBNotasAlarm</code> e <code>Capacitor/Console</code>.
            </div>

            {alarmInfo && (
              <div className="rounded-md border border-border bg-bg-base px-3 py-2.5 text-[12.5px] leading-relaxed">
                <div>
                  Aparelho: <b>{alarmInfo.manufacturer} {alarmInfo.model}</b> · Android SDK{' '}
                  {alarmInfo.sdkInt}
                </div>
                <div>
                  Notificações habilitadas:{' '}
                  <b style={{ color: alarmInfo.notificationsEnabled ? '#4ade80' : '#f87171' }}>
                    {alarmInfo.notificationsEnabled ? 'sim' : 'não'}
                  </b>
                </div>
                <div>
                  Tela cheia do alarme permitida:{' '}
                  <b style={{ color: alarmInfo.canUseFullScreenIntent ? '#4ade80' : '#f87171' }}>
                    {alarmInfo.canUseFullScreenIntent ? 'sim' : 'não (Android 14+ bloqueia)'}
                  </b>
                </div>
                <div>
                  Alarme exato: <b>{alarmInfo.canScheduleExactAlarms ? 'sim' : 'não'}</b>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={loadAlarmInfo}
                className="h-9 rounded-md border border-border bg-bg-base px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Atualizar estado
              </button>
              <button
                onClick={testNotif}
                className="h-9 rounded-md border border-border bg-bg-base px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Notificação do SO
              </button>
              <button
                onClick={testScheduledAlarm}
                className="h-9 rounded-md border border-border bg-bg-base px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Alarme em 15s
              </button>
              <button
                onClick={testFireNow}
                className="h-9 rounded-md border border-border bg-bg-base px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Disparar alarme agora
              </button>
              <button
                onClick={testScheduledNotif}
                className="h-9 rounded-md border border-border bg-bg-base px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Notificação agendada (20s)
              </button>
              {alarmInfo && !alarmInfo.canUseFullScreenIntent && (
                <button
                  onClick={openFsSettings}
                  className="h-9 rounded-md bg-accent px-3.5 text-[13px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
                >
                  Conceder tela cheia
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* Sobre — versão + reabrir as novidades */}
      <div className="overflow-hidden rounded-md border border-border bg-bg-elevated">
        <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
          Sobre
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <Icon name="sparkles" size={18} style={{ color: 'var(--text-secondary)' }} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">SB Notas</div>
            <div className="text-[12.5px] text-text-muted">Versão {CURRENT_VERSION}</div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(WHATS_NEW_EVENT))}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-bg-base px-3 text-[13px] font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Icon name="sparkles" size={14} /> Ver novidades
          </button>
        </div>
      </div>
    </div>
  )
}

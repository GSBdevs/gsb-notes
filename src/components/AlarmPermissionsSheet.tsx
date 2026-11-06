import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { platform } from '@/platform'
import type { AlarmInfo } from '@/platform/nativeAlarm'
import { Modal } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'

const DISMISS_KEY = 'sb-notas.alarmPerms.dismissed.v1'

/**
 * Onboarding de permissões do alarme (Android/Capacitor). O disparo em tela cheia, no horário certo e
 * mesmo com o app fechado depende de 4 permissões do SO que o usuário concede uma vez. Mostra o estado
 * de cada uma + um botão para conceder. Abre sozinho na 1ª vez em que falta algo ESSENCIAL
 * (notificações / tela cheia / sobre outros apps) e fica re-abrível em Ajustes. Fora do Capacitor é no-op.
 */
export function AlarmPermissionsSheet() {
  const open = useAppStore((s) => s.alarmPermsOpen)
  const openPerms = useAppStore((s) => s.openAlarmPerms)
  const close = useAppStore((s) => s.closeAlarmPerms)
  const [info, setInfo] = useState<AlarmInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const checkedOnce = useRef(false)

  const isNative = platform.kind === 'capacitor'

  const refresh = useCallback(async () => {
    if (!isNative) return null
    try {
      const { Alarm } = await import('@/platform/nativeAlarm')
      const i = await Alarm.getInfo()
      setInfo(i)
      return i
    } catch {
      return null
    }
  }, [isNative])

  // Auto-abre na 1ª vez (por dispositivo) se faltar algo ESSENCIAL e o usuário ainda não dispensou.
  useEffect(() => {
    if (!isNative || checkedOnce.current) return
    checkedOnce.current = true
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      /* localStorage indisponível */
    }
    void (async () => {
      const i = await refresh()
      if (!i) return
      const essentialOk = i.notificationsEnabled && i.canUseFullScreenIntent && i.canDrawOverlays
      if (!essentialOk && !dismissed) openPerms()
    })()
  }, [isNative, refresh, openPerms])

  // Re-checa o estado ao voltar do app de configurações do sistema.
  useEffect(() => {
    if (!open) return
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [open, refresh])

  if (!isNative || !open) return null

  const grantNotif = async () => {
    setBusy(true)
    try {
      await platform.requestNotificationPermission()
    } finally {
      setBusy(false)
    }
    await refresh()
  }

  const openSetting = async (which: 'fullscreen' | 'overlay' | 'battery') => {
    try {
      const { Alarm } = await import('@/platform/nativeAlarm')
      if (which === 'fullscreen') await Alarm.openFullScreenSettings()
      else if (which === 'overlay') await Alarm.openOverlaySettings()
      else await Alarm.openBatterySettings()
    } catch {
      /* plugin indisponível */
    }
  }

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* localStorage indisponível */
    }
    close()
  }

  type Row = { key: string; title: string; desc: string; ok: boolean; essential: boolean; action: () => void }
  const rows: Row[] = info
    ? [
        {
          key: 'notif',
          title: 'Notificações',
          desc: 'Sem elas o alarme não aparece na barra.',
          ok: info.notificationsEnabled,
          essential: true,
          action: () => void grantNotif(),
        },
        {
          key: 'fullscreen',
          title: 'Tela cheia do alarme',
          desc: 'Deixa o alarme abrir em tela cheia por cima do bloqueio (Android 14+).',
          ok: info.canUseFullScreenIntent,
          essential: true,
          action: () => void openSetting('fullscreen'),
        },
        {
          key: 'overlay',
          title: 'Aparecer sobre outros apps',
          desc: 'Faz o alarme abrir sozinho mesmo com a tela ligada, sem precisar tocar na notificação.',
          ok: info.canDrawOverlays,
          essential: true,
          action: () => void openSetting('overlay'),
        },
        {
          key: 'battery',
          title: 'Bateria sem restrição',
          desc: 'Evita que o sistema atrase o alarme (economia de bateria / Doze).',
          ok: info.isIgnoringBatteryOptimizations,
          essential: false,
          action: () => void openSetting('battery'),
        },
      ]
    : []

  const allOk = rows.length > 0 && rows.every((r) => r.ok)

  return (
    <Modal
      title="Permissões do alarme"
      onClose={dismiss}
      footer={
        <>
          <button
            onClick={() => void refresh()}
            className="h-[42px] rounded-md border border-border bg-transparent px-[18px] text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Atualizar estado
          </button>
          <div className="flex-1" />
          <button
            onClick={dismiss}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
          >
            {allOk ? 'Tudo pronto' : 'Agora não'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 p-5">
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Para o alarme disparar na hora, em tela cheia e mesmo com o app fechado, o Android pede estas
          permissões. Toque em <b>Permitir</b> em cada uma e volte aqui — o estado atualiza sozinho.
        </p>
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-start gap-3 rounded-lg border border-border bg-bg-base px-3.5 py-3"
          >
            <Icon
              name={r.ok ? 'check-circle' : 'alert-triangle'}
              size={18}
              style={{ color: r.ok ? 'var(--success)' : 'var(--warning)', marginTop: 2 }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold">{r.title}</span>
                {!r.essential && (
                  <span className="rounded-full bg-bg-elevated-2 px-2 py-0.5 text-[10.5px] font-semibold text-text-muted">
                    recomendado
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-text-muted">{r.desc}</p>
            </div>
            {r.ok ? (
              <span className="flex-none self-center text-[12px] font-semibold text-success">ok</span>
            ) : (
              <button
                onClick={r.action}
                disabled={busy}
                className="h-8 flex-none self-center rounded-md bg-accent px-3 text-[12.5px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                Permitir
              </button>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}

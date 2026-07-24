import type { Settings } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { Toggle } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/Icon'

interface Row {
  icon: string
  label: string
  desc: string
  key: keyof Settings
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Notificações & permissões',
    rows: [
      { icon: 'alarm-clock', label: 'Alarme na hora do lembrete', desc: 'Som e overlay quando um lembrete dispara', key: 'alarm' },
      { icon: 'pin', label: 'Janela sempre no topo (Windows)', desc: 'O overlay aparece por cima de tudo', key: 'ontop' },
      { icon: 'volume-2', label: 'Som de disparo', desc: 'Toca um alerta curto ao disparar', key: 'sound' },
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

  return (
    <div className="flex max-w-[640px] flex-col gap-3.5">
      {GROUPS.map((g) => (
        <div key={g.title} className="overflow-hidden rounded-md border border-border bg-bg-elevated">
          <div className="border-b border-border px-4 py-3.5 text-[13px] font-semibold uppercase tracking-[.05em] text-text-muted">
            {g.title}
          </div>
          {g.rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
              <Icon name={r.icon} size={18} style={{ color: 'var(--text-secondary)' }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{r.label}</div>
                <div className="text-[12.5px] text-text-muted">{r.desc}</div>
              </div>
              <Toggle checked={settings[r.key]} onChange={() => toggleSetting(r.key)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

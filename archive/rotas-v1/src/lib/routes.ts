import type { CallType } from '@/types'

/** Tipos de chamado (rótulos pt-BR). Ordem = ordem no seletor. */
export const CALL_TYPES: { value: CallType; label: string }[] = [
  { value: 'corretiva', label: 'Corretiva' },
  { value: 'preventiva', label: 'Preventiva' },
  { value: 'instalacao', label: 'Instalação' },
  { value: 'entrega_suprimento', label: 'Entrega de suprimento' },
  { value: 'leitura', label: 'Leitura de medidor' },
  { value: 'outro', label: 'Outro' },
]

export const callTypeLabel = (t: CallType) => CALL_TYPES.find((c) => c.value === t)?.label ?? t

/** Cor neutra para chamados sem técnico. */
export const NO_TECH_COLOR = '#94A3B8'

/** Data local de hoje em 'YYYY-MM-DD'. */
export function todayIso(): string {
  return toIsoDay(new Date())
}

export function toIsoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Soma dias a um 'YYYY-MM-DD' (meio-dia local, imune a horário de verão). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + n)
  return toIsoDay(d)
}

/** "Hoje" / "Amanhã" / "Ontem" / "qua., 23 de out." */
export function dayLabel(day: string): string {
  const today = todayIso()
  if (day === today) return 'Hoje'
  if (day === addDays(today, 1)) return 'Amanhã'
  if (day === addDays(today, -1)) return 'Ontem'
  return new Date(`${day}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Segundos → "12 min" / "1 h 05". */
export function fmtDuration(sec: number): string {
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

/** Metros → "850 m" / "5,3 km". */
export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

/** 'HH:MM' + minutos → 'HH:MM' (passa da meia-noite sem dia). */
export function addClock(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = Math.round((h || 0) * 60 + (m || 0) + minutes)
  const t = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Número inteiro de um input (vazio → null). */
export function intOrNull(v: string): number | null {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

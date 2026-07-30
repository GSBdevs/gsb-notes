import type { Priority, Recurrence } from '@/types'

/** Paleta de cores por lembrete (customização do usuário). Cor vai na borda, nunca no fundo. */
export const CARD_COLORS: { name: string; hex: string }[] = [
  { name: 'Amarelo', hex: '#FACC15' },
  { name: 'Âmbar', hex: '#F59E0B' },
  { name: 'Vermelho', hex: '#EF4444' },
  { name: 'Verde', hex: '#22C55E' },
  { name: 'Azul', hex: '#60A5FA' },
  { name: 'Roxo', hex: '#A78BFA' },
  { name: 'Rosa', hex: '#F472B6' },
  { name: 'Cinza', hex: '#94A3B8' },
]

export interface PriorityMeta {
  label: string
  icon: string // nome do ícone lucide-react (kebab → mapeado no componente)
  color: string
}

export const PRIORITIES: Record<Priority, PriorityMeta> = {
  normal: { label: 'Normal', icon: 'circle', color: '#94A3B8' },
  important: { label: 'Importante', icon: 'flag', color: '#F59E0B' },
  urgent: { label: 'Urgente', icon: 'alert-triangle', color: '#EF4444' },
}

export const RECURRENCES: { key: Recurrence; label: string }[] = [
  { key: 'once', label: 'Uma vez' },
  { key: 'daily', label: 'Diário' },
  { key: 'weekly', label: 'Semanal' },
  { key: 'monthly', label: 'Mensal' },
]

/** Cor de fundo translúcida a partir de um hex (para chips de prioridade). */
export function tint(hex: string, alpha = '1f'): string {
  return `${hex}${alpha}`
}

/** Iniciais a partir de um nome ("Sávio B." → "SB", "Marina Braga" → "MB"). */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

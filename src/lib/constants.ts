import type { Priority, Recurrence } from '@/types'

/**
 * Paleta de cores por lembrete (também usada no acento do tema e nos avatares).
 * Todos os tons são nível ~400 — vivos sobre o fundo preto e legíveis com texto escuro
 * (#0A0A0B) por cima. A cor vai na borda/acento, nunca no fundo. Amarelo é o padrão.
 */
export const CARD_COLORS: { name: string; hex: string }[] = [
  { name: 'Amarelo', hex: '#FACC15' },
  { name: 'Âmbar', hex: '#F59E0B' },
  { name: 'Laranja', hex: '#FB923C' },
  { name: 'Coral', hex: '#FB7185' },
  { name: 'Vermelho', hex: '#F87171' },
  { name: 'Rosa', hex: '#F472B6' },
  { name: 'Fúcsia', hex: '#E879F9' },
  { name: 'Roxo', hex: '#A78BFA' },
  { name: 'Índigo', hex: '#818CF8' },
  { name: 'Azul', hex: '#60A5FA' },
  { name: 'Ciano', hex: '#22D3EE' },
  { name: 'Verde-água', hex: '#2DD4BF' },
  { name: 'Verde', hex: '#4ADE80' },
  { name: 'Lima', hex: '#A3E635' },
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

/** Intervalos do auto-snooze (min) — modelo Due (1/5/10/15/30/60). */
export const SNOOZE_INTERVALS: { min: number; label: string }[] = [
  { min: 1, label: '1 min' },
  { min: 5, label: '5 min' },
  { min: 10, label: '10 min' },
  { min: 15, label: '15 min' },
  { min: 30, label: '30 min' },
  { min: 60, label: '1 h' },
]

/** Teto de segurança: quantas vezes o auto-snooze re-alerta antes de desistir. */
export const MAX_SNOOZE_ATTEMPTS = 5

/** Normaliza um intervalo de snooze para um valor válido (default 10 min). */
export function normalizeSnoozeInterval(min: number | undefined | null): number {
  const found = SNOOZE_INTERVALS.find((s) => s.min === min)
  return found ? found.min : 10
}

/** Cor de fundo translúcida a partir de um hex (para chips de prioridade). */
export function tint(hex: string, alpha = '1f'): string {
  return `${hex}${alpha}`
}

/**
 * Status online de uma pessoa: com Supabase, usa a presença ao vivo (`onlineIds`);
 * sem backend (mock), cai no campo `online` do seed.
 */
export function personIsOnline(
  userId: string,
  onlineIds: string[],
  seedOnline: boolean,
  supabaseOn: boolean,
): boolean {
  return supabaseOn ? onlineIds.includes(userId) : seedOnline
}

/** Iniciais a partir de um nome ("Sávio B." → "SB", "Marina Braga" → "MB"). */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

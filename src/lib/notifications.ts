import type { AppNotification } from '@/types'

/** Rótulo do dia de uma notificação (Hoje / Ontem / dd/mm/aaaa). */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Anteriores'
  const now = new Date()
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(d, now)) return 'Hoje'
  if (sameDay(d, yesterday)) return 'Ontem'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

/**
 * Agrupa notificações (já ordenadas do mais novo para o mais antigo) por dia,
 * preservando a ordem — para a tela de notificações.
 */
export function groupNotificationsByDay(
  list: AppNotification[],
): { label: string; items: AppNotification[] }[] {
  const groups: Record<string, AppNotification[]> = {}
  const order: string[] = []
  for (const n of list) {
    const label = dayLabel(n.createdAt)
    if (!groups[label]) {
      groups[label] = []
      order.push(label)
    }
    groups[label].push(n)
  }
  return order.map((label) => ({ label, items: groups[label] }))
}

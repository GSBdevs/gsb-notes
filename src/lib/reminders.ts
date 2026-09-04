import type { Recurrence, Reminder, Status, Workspace } from '@/types'

/**
 * Posso editar/concluir este item? Dono sempre; share 1:1 com permissão 'edit'; ou membro do
 * quadro com papel de edição (owner/admin/member — viewer NÃO edita). Os quadros que participo
 * (com meu papel) vêm de useWorkspaces.
 */
export function canEditReminder(r: Reminder, workspaces: readonly Workspace[]): boolean {
  if (r.mine) return true
  if (r.myShare === 'edit') return true
  if (r.workspaceId == null) return false
  const w = workspaces.find((x) => x.id === r.workspaceId)
  return !!w && w.myRole != null && w.myRole !== 'viewer'
}

/** Texto amigável a partir do timestamp (ex.: "Hoje, 14:30", "25 jul, 09:00"). */
export function formatRemindAt(iso: string | null): string {
  if (!iso) return 'Sem horário'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Sem horário'
  const now = new Date()
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (sameDay(d, now)) return `Hoje, ${time}`
  if (sameDay(d, tomorrow)) return `Amanhã, ${time}`
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` // dd/mm/aaaa
  return `${date}, ${time}`
}

/**
 * Status exibido no mural. "Agendado" é DERIVADO: um lembrete ativo cujo disparo
 * ainda está no futuro. `rawStatus` é o que o backend persiste (active | archived).
 */
export function deriveStatus(rawStatus: 'active' | 'archived', remindAt: string | null): Status {
  if (rawStatus === 'archived') return 'archived'
  if (remindAt && new Date(remindAt).getTime() > Date.now()) return 'scheduled'
  return 'active'
}

/** Quebra um ISO em partes locais para os inputs de data/hora (vazio se null/inválido). */
export function isoToLocalParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

/** Recombina data (YYYY-MM-DD) + hora (HH:MM) locais em ISO. Null se faltar algo. */
export function localPartsToIso(date: string, time: string): string | null {
  if (!date || !time) return null
  const d = new Date(`${date}T${time}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** ISO → valor de um `<input type="datetime-local">` (vazio se sem horário). */
export function isoToDatetimeLocal(iso: string | null): string {
  const { date, time } = isoToLocalParts(iso)
  return date && time ? `${date}T${time}` : ''
}

/** Valor de `datetime-local` → ISO (null se vazio/inválido). */
export function datetimeLocalToIso(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Agora, com segundos/ms zerados — padrão de "Lembrar em" ao abrir um novo lembrete. */
export function nowRoundedIso(): string {
  const d = new Date()
  d.setSeconds(0, 0)
  return d.toISOString()
}

/** ISO → partes pt-BR para o campo customizado: data "dd/mm/aaaa" e hora "HH:mm". */
export function isoToBrParts(iso: string | null): { date: string; time: string } {
  const { date, time } = isoToLocalParts(iso) // date = aaaa-mm-dd
  if (!date) return { date: '', time }
  const [y, m, d] = date.split('-')
  return { date: `${d}/${m}/${y}`, time }
}

/**
 * Data "dd/mm/aaaa" + hora "HH:mm" (pt-BR) → ISO. Null se incompleto/ inválido.
 * Valida de verdade (rejeita 31/02, mês 13, hora 25…) via round-trip do Date.
 */
export function brPartsToIso(date: string, time: string): string | null {
  const dm = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const tm = time.match(/^(\d{2}):(\d{2})$/)
  if (!dm || !tm) return null
  const [, dd, mm, yyyy] = dm
  const [, hh, mi] = tm
  const day = Number(dd)
  const month = Number(mm)
  const hour = Number(hh)
  const min = Number(mi)
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || min > 59) return null
  const d = new Date(Number(yyyy), month - 1, day, hour, min)
  if (Number.isNaN(d.getTime())) return null
  // Round-trip: rejeita datas que "transbordam" (ex.: 31/04 vira 01/05).
  if (d.getDate() !== day || d.getMonth() !== month - 1) return null
  return d.toISOString()
}

/**
 * Próxima ocorrência de um lembrete recorrente, no futuro (pula ocorrências perdidas).
 * Retorna null para 'once' ou entrada inválida.
 */
export function nextOccurrence(iso: string, recurrence: Recurrence): string | null {
  if (recurrence === 'once') return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = Date.now()
  let guard = 0
  do {
    if (recurrence === 'daily') d.setDate(d.getDate() + 1)
    else if (recurrence === 'weekly') d.setDate(d.getDate() + 7)
    else if (recurrence === 'monthly') d.setMonth(d.getMonth() + 1)
    else return null
  } while (d.getTime() <= now && ++guard < 1000)
  return d.toISOString()
}

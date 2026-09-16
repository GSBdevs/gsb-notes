import type { Recurrence, RecurrenceRule, Reminder, Status, Workspace } from '@/types'

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

/**
 * Posso ver os recibos por-destinatário deste lembrete (quem viu/concluiu/adiou)?
 * Só o dono da nota, ou um admin/owner do quadro a que ela pertence.
 */
export function canSeeReceipts(r: Reminder, workspaces: readonly Workspace[]): boolean {
  if (r.mine) return true
  if (r.workspaceId == null) return false
  const w = workspaces.find((x) => x.id === r.workspaceId)
  return !!w && (w.myRole === 'owner' || w.myRole === 'admin')
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

const WD_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const NTH_LABEL: Record<number, string> = { 1: '1ª', 2: '2ª', 3: '3ª', 4: '4ª', [-1]: 'última' }

/** Início da semana (domingo, 00:00) de uma data. */
function weekStart(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - x.getDay())
  return x
}

/**
 * Data da N-ésima ocorrência de um dia-da-semana num mês (nth = -1 → última).
 * Retorna null se não existir (ex.: 5ª sexta num mês que só tem 4).
 */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number,
  hour: number,
  min: number,
): Date | null {
  if (nth === -1) {
    const last = new Date(year, month + 1, 0) // último dia do mês
    const diff = (last.getDay() - weekday + 7) % 7
    const day = last.getDate() - diff
    return new Date(year, month, day, hour, min, 0, 0)
  }
  const first = new Date(year, month, 1)
  const firstMatch = 1 + ((weekday - first.getDay() + 7) % 7)
  const day = firstMatch + (nth - 1) * 7
  if (day > new Date(year, month + 1, 0).getDate()) return null // não existe (ex.: 5ª ocorrência)
  return new Date(year, month, day, hour, min, 0, 0)
}

/** Regra efetiva a partir da frequência base + parâmetros avançados (default: a cada 1). */
function effectiveRule(recurrence: Recurrence, rule?: RecurrenceRule | null): RecurrenceRule | null {
  if (recurrence === 'once') return null
  if (rule && rule.freq) return { ...rule, interval: Math.max(1, Math.floor(rule.interval || 1)) }
  return { freq: recurrence, interval: 1 }
}

/**
 * Próxima ocorrência de um lembrete recorrente, no futuro (pula ocorrências perdidas).
 * Suporta recorrência avançada (#3): "a cada N", dias da semana específicos, N-ésima weekday do mês.
 * Retorna null para 'once' ou entrada inválida.
 */
export function nextOccurrence(
  iso: string,
  recurrence: Recurrence,
  rule?: RecurrenceRule | null,
  nowMs: number = Date.now(),
): string | null {
  const start = new Date(iso)
  if (Number.isNaN(start.getTime())) return null
  const r = effectiveRule(recurrence, rule)
  if (!r) return null
  const now = nowMs
  const interval = r.interval
  const hour = start.getHours()
  const min = start.getMinutes()

  if (r.freq === 'daily') {
    const d = new Date(start)
    let guard = 0
    do {
      d.setDate(d.getDate() + interval)
    } while (d.getTime() <= now && ++guard < 4000)
    return d.toISOString()
  }

  if (r.freq === 'weekly') {
    const days = r.weekdays && r.weekdays.length ? [...new Set(r.weekdays)] : [start.getDay()]
    const anchorWeek = weekStart(start).getTime()
    const cand = new Date(start)
    let guard = 0
    do {
      cand.setDate(cand.getDate() + 1)
      cand.setHours(hour, min, 0, 0)
      const wk = Math.round((weekStart(cand).getTime() - anchorWeek) / (7 * 86_400_000))
      if (days.includes(cand.getDay()) && wk % interval === 0 && cand.getTime() > now) {
        return cand.toISOString()
      }
    } while (++guard < 4000)
    return null
  }

  // monthly
  if (r.monthly === 'nth' && r.weekday != null && r.nth) {
    let y = start.getFullYear()
    let m = start.getMonth()
    let guard = 0
    while (guard++ < 600) {
      const occ = nthWeekdayOfMonth(y, m, r.weekday, r.nth, hour, min)
      if (occ && occ.getTime() > now && occ.getTime() > start.getTime()) return occ.toISOString()
      m += interval
      while (m > 11) {
        m -= 12
        y += 1
      }
    }
    return null
  }
  // monthly por dia-do-mês
  const day = start.getDate()
  let y = start.getFullYear()
  let m = start.getMonth()
  let guard = 0
  do {
    m += interval
    while (m > 11) {
      m -= 12
      y += 1
    }
    const d = new Date(y, m, day, hour, min, 0, 0)
    if (d.getDate() === day && d.getTime() > now) return d.toISOString() // pula meses sem esse dia (ex.: 31)
  } while (++guard < 600)
  return null
}

/** Descrição amigável da recorrência (ex.: "A cada 2 semanas · seg, qua", "Toda última sex"). */
export function describeRecurrence(recurrence: Recurrence, rule?: RecurrenceRule | null): string {
  const r = effectiveRule(recurrence, rule)
  if (!r) return 'Uma vez'
  const n = r.interval

  if (r.freq === 'daily') return n === 1 ? 'Diário' : `A cada ${n} dias`

  if (r.freq === 'weekly') {
    const days = r.weekdays && r.weekdays.length ? [...new Set(r.weekdays)].sort((a, b) => a - b) : null
    const base = n === 1 ? 'Semanal' : `A cada ${n} semanas`
    if (!days) return base
    const names = days.map((d) => WD_SHORT[d]).join(', ')
    return n === 1 ? `Toda ${names}` : `${base} · ${names}`
  }

  // monthly
  if (r.monthly === 'nth' && r.weekday != null && r.nth) {
    const ord = NTH_LABEL[r.nth] ?? `${r.nth}ª`
    const wd = WD_SHORT[r.weekday]
    const every = n === 1 ? 'Toda' : `A cada ${n} meses ·`
    return `${every} ${ord} ${wd}`
  }
  return n === 1 ? 'Mensal' : `A cada ${n} meses`
}

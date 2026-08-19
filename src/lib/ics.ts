import type { Reminder } from '@/types'

/** Escapa texto para o formato iCalendar (RFC 5545). */
function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Date → "YYYYMMDDTHHMMSSZ" (UTC, formato básico do iCalendar). */
function utc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

const RRULES: Record<string, string | null> = {
  once: null,
  daily: 'FREQ=DAILY',
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
}

/**
 * Exporta lembretes agendados como calendário .ics (importável no Google/Outlook/Apple).
 * Recorrência vira RRULE; cada evento tem um VALARM no horário exato.
 */
export function buildIcs(reminders: Reminder[]): string {
  const now = utc(new Date().toISOString())
  const events = reminders
    .filter((r) => r.kind === 'reminder' && r.remindAt && r.status !== 'archived')
    .map((r) => {
      const lines = [
        'BEGIN:VEVENT',
        `UID:${r.id}@sb-notas`,
        `DTSTAMP:${now}`,
        `DTSTART:${utc(r.remindAt!)}`,
        `SUMMARY:${esc(r.title)}`,
      ]
      if (r.body) lines.push(`DESCRIPTION:${esc(r.body)}`)
      const rrule = RRULES[r.recurrence]
      if (rrule) lines.push(`RRULE:${rrule}`)
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(r.title)}`, 'TRIGGER:PT0S', 'END:VALARM')
      lines.push('END:VEVENT')
      return lines.join('\r\n')
    })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SB Notas//Lembretes//PT-BR',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

/** Dispara o download do .ics no navegador. */
export function downloadIcs(reminders: Reminder[]): number {
  const eligible = reminders.filter(
    (r) => r.kind === 'reminder' && r.remindAt && r.status !== 'archived',
  ).length
  const blob = new Blob([buildIcs(reminders)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'sb-notas.ics'
  a.click()
  URL.revokeObjectURL(url)
  return eligible
}

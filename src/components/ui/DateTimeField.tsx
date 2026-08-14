import { useEffect, useState } from 'react'
import { brPartsToIso, isoToBrParts, isoToLocalParts } from '@/lib/reminders'
import { Icon } from './Icon'

/** Digitação → "dd/mm/aaaa" (só dígitos, barras automáticas). */
function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  let out = d.slice(0, 2)
  if (d.length >= 3) out += '/' + d.slice(2, 4)
  if (d.length >= 5) out += '/' + d.slice(4, 8)
  return out
}

/** Digitação → "HH:mm" (só dígitos, dois-pontos automático). */
function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  let out = d.slice(0, 2)
  if (d.length >= 3) out += ':' + d.slice(2, 4)
  return out
}

interface Props {
  /** Valor em ISO (null = sem horário). */
  value: string | null
  onChange: (iso: string | null) => void
}

/**
 * Campo de data/hora em pt-BR (dd/mm/aaaa · HH:mm), independente do locale do browser
 * — o `<input datetime-local>` nativo mostra mm/dd em locales en-US. Digitação mascarada,
 * com um atalho de calendário nativo (ícone). Vazio nos dois campos = "sem horário".
 */
export function DateTimeField({ value, onChange }: Props) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  // Sincroniza quando o valor muda por fora (abrir novo lembrete = agora; editar = valor salvo).
  useEffect(() => {
    const p = isoToBrParts(value)
    setDate(p.date)
    setTime(p.time)
  }, [value])

  const emit = (d: string, t: string) => {
    if (!d && !t) {
      onChange(null)
      return
    }
    const iso = brPartsToIso(d, t)
    if (iso) onChange(iso) // incompleto/ inválido: mantém o último válido, sem propagar
  }

  const onDate = (raw: string) => {
    const f = maskDate(raw)
    setDate(f)
    emit(f, time)
  }
  const onTime = (raw: string) => {
    const f = maskTime(raw)
    setTime(f)
    emit(date, f)
  }
  const clear = () => {
    setDate('')
    setTime('')
    onChange(null)
  }

  const filled = Boolean(date || time)
  const invalid = filled && !brPartsToIso(date, time)

  return (
    <div>
      <div className="flex items-stretch gap-2">
        {/* Data (mascarada) + atalho de calendário nativo sobreposto no ícone */}
        <div
          className={`relative flex h-[42px] flex-1 items-center gap-2 rounded-md border bg-bg-base px-3 focus-within:border-border-strong ${
            invalid ? 'border-danger' : 'border-border'
          }`}
        >
          <span className="relative grid h-6 w-6 flex-none place-items-center text-text-muted">
            <Icon name="calendar" size={16} />
            {/* input nativo transparente por cima do ícone → abre o calendário do SO */}
            <input
              type="date"
              aria-label="Escolher data no calendário"
              value={isoToLocalParts(value).date}
              onChange={(e) => {
                const v = e.target.value // aaaa-mm-dd
                if (!v) return
                const [y, m, d] = v.split('-')
                const f = `${d}/${m}/${y}`
                setDate(f)
                emit(f, time)
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
              style={{ colorScheme: 'dark' }}
            />
          </span>
          <input
            value={date}
            onChange={(e) => onDate(e.target.value)}
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>

        {/* Hora (mascarada) */}
        <div
          className={`flex h-[42px] w-[112px] flex-none items-center gap-2 rounded-md border bg-bg-base px-3 focus-within:border-border-strong ${
            invalid ? 'border-danger' : 'border-border'
          }`}
        >
          <Icon name="clock" size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            value={time}
            onChange={(e) => onTime(e.target.value)}
            inputMode="numeric"
            placeholder="HH:mm"
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
        </div>

        {/* Limpar (volta para "sem horário") */}
        {filled && (
          <button
            type="button"
            onClick={clear}
            title="Sem horário"
            aria-label="Remover horário"
            className="grid h-[42px] w-[42px] flex-none place-items-center rounded-md border border-border bg-bg-base text-text-muted transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
      {invalid && (
        <p className="mt-1.5 text-[12px] font-medium text-danger">Data ou hora inválida.</p>
      )}
    </div>
  )
}

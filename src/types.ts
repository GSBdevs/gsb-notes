/** Modelo de domínio do SB Notas (espelha docs/03-arquitetura-escopo.md §6). */

export type Priority = 'normal' | 'important' | 'urgent'
export type Status = 'active' | 'scheduled' | 'archived'
export type Perm = 'view' | 'edit'
export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly'

/** Compartilhamento de um lembrete com uma pessoa. */
export interface Share {
  userId: string
  initials: string
  name: string
  color: string
  perm: Perm
}

export interface Reminder {
  id: string
  title: string
  body: string
  color: string // uma das CARD_COLORS
  priority: Priority
  pinned: boolean
  /** Momento do disparo em ISO (null = sem alarme). Fonte da verdade do agendamento. */
  remindAt: string | null
  /** Rótulo já formatado a partir de `remindAt` (ex.: "Hoje, 14:30"). Derivado. */
  time: string
  recurrence: Recurrence
  status: Status
  shares: Share[]
}

/** Rascunho manipulado pelo editor antes de virar Reminder. */
export interface ReminderDraft {
  mode: 'new' | 'edit'
  id: string | null
  title: string
  body: string
  color: string
  priority: Priority
  pinned: boolean
  /** ISO do disparo (null = sem alarme). */
  remindAt: string | null
  recurrence: Recurrence
  shares: Share[]
}

export interface Person {
  userId: string
  initials: string
  name: string
  color: string
  perm: Perm
  online: boolean
}

export interface Settings {
  alarm: boolean
  ontop: boolean
  sound: boolean
  presence: boolean
  reduce: boolean
  /** Iniciar com o SO (só desktop/Tauri). Fonte da verdade é o próprio SO. */
  autostart: boolean
}

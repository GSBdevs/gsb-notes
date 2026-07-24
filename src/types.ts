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
  /** Rótulo já formatado para exibição (ex.: "Hoje, 14:30"). Na Fase 2 vira ISO + formatação. */
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
}

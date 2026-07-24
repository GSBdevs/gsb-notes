import type { Person, Reminder, ReminderDraft } from '@/types'
import { SEED_PEOPLE, SEED_REMINDERS } from '@/data/mock'
import { hasSupabase } from './supabase'

/**
 * Contrato de dados do SB Notas. A UI só conhece esta interface — nunca o Supabase direto.
 * Trocar de backend = trocar a implementação exportada em `notesService`, sem tocar em telas.
 */
export interface NotesService {
  listReminders(): Promise<Reminder[]>
  createReminder(draft: ReminderDraft): Promise<Reminder>
  updateReminder(id: string, draft: ReminderDraft): Promise<Reminder>
  setStatus(id: string, status: Reminder['status']): Promise<void>
  listPeople(): Promise<Person[]>
}

const STORAGE_KEY = 'sb-notas.reminders.v1'
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `r${Date.now()}`

/**
 * Implementação em memória (Fase 1), espelhada em localStorage para sobreviver a reloads.
 * Simula latência de rede para exercitar os estados de UI. Na Fase 2, dá lugar a uma impl
 * Supabase com a mesma interface (Postgres + Realtime + RLS).
 */
class MockNotesService implements NotesService {
  private reminders: Reminder[] = load()
  private people: Person[] = SEED_PEOPLE.map((p) => ({ ...p }))

  async listReminders() {
    await delay()
    return this.reminders.map((r) => ({ ...r }))
  }

  async createReminder(draft: ReminderDraft) {
    await delay()
    const reminder: Reminder = {
      id: newId(),
      title: draft.title.trim() || 'Sem título',
      body: draft.body,
      color: draft.color,
      priority: draft.priority,
      pinned: draft.pinned,
      time: 'Hoje, 14:30',
      recurrence: draft.recurrence,
      status: 'active',
      shares: draft.shares,
    }
    this.reminders = [reminder, ...this.reminders]
    this.persist()
    return { ...reminder }
  }

  async updateReminder(id: string, draft: ReminderDraft) {
    await delay()
    let updated: Reminder | undefined
    this.reminders = this.reminders.map((r) => {
      if (r.id !== id) return r
      updated = {
        ...r,
        title: draft.title.trim() || 'Sem título',
        body: draft.body,
        color: draft.color,
        priority: draft.priority,
        pinned: draft.pinned,
        recurrence: draft.recurrence,
        shares: draft.shares,
      }
      return updated
    })
    if (!updated) throw new Error(`Lembrete ${id} não encontrado`)
    this.persist()
    return { ...updated }
  }

  async setStatus(id: string, status: Reminder['status']) {
    await delay()
    this.reminders = this.reminders.map((r) => (r.id === id ? { ...r, status } : r))
    this.persist()
  }

  async listPeople() {
    await delay()
    return this.people.map((p) => ({ ...p }))
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reminders))
    } catch {
      /* localStorage indisponível: segue só em memória */
    }
  }
}

function load(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Reminder[]
  } catch {
    /* ignora e cai no seed */
  }
  return SEED_REMINDERS.map((r) => ({ ...r }))
}

function delay(ms = 120) {
  return new Promise((res) => setTimeout(res, ms))
}

/**
 * Serviço ativo. Hoje: mock. Fase 2: quando `hasSupabase`, apontar para um
 * SupabaseNotesService que implemente a mesma interface (Postgres + Realtime + RLS).
 */
export const notesService: NotesService = hasSupabase
  ? new MockNotesService() // TODO(Fase 2): substituir por SupabaseNotesService
  : new MockNotesService()

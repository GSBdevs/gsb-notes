import type { Perm, Person, Reminder, ReminderDraft } from '@/types'
import { SEED_PEOPLE, SEED_REMINDERS } from '@/data/mock'
import { deriveStatus, formatRemindAt } from '@/lib/reminders'
import { hasSupabase } from './supabase'
import { SupabaseNotesService } from './supabaseNotesService'

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
  updatePersonPerm(userId: string, perm: Perm): Promise<void>
  removePerson(userId: string): Promise<void>
}

const STORAGE_KEY = 'sb-notas.reminders.v1'
const PEOPLE_KEY = 'sb-notas.people.v1'
const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `r${Date.now()}`

/**
 * Implementação em memória (Fase 1), espelhada em localStorage para sobreviver a reloads.
 * Simula latência de rede para exercitar os estados de UI. Na Fase 2, dá lugar a uma impl
 * Supabase com a mesma interface (Postgres + Realtime + RLS).
 */
class MockNotesService implements NotesService {
  private reminders: Reminder[] = load()
  private people: Person[] = loadPeople()

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
      remindAt: draft.remindAt,
      time: formatRemindAt(draft.remindAt),
      recurrence: draft.recurrence,
      status: deriveStatus('active', draft.remindAt),
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
        remindAt: draft.remindAt,
        time: formatRemindAt(draft.remindAt),
        recurrence: draft.recurrence,
        status: r.status === 'archived' ? 'archived' : deriveStatus('active', draft.remindAt),
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

  async updatePersonPerm(userId: string, perm: Perm) {
    await delay()
    this.people = this.people.map((p) => (p.userId === userId ? { ...p, perm } : p))
    this.persistPeople()
  }

  async removePerson(userId: string) {
    await delay()
    this.people = this.people.filter((p) => p.userId !== userId)
    this.persistPeople()
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.reminders))
    } catch {
      /* localStorage indisponível: segue só em memória */
    }
  }

  private persistPeople() {
    try {
      localStorage.setItem(PEOPLE_KEY, JSON.stringify(this.people))
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

function loadPeople(): Person[] {
  try {
    const raw = localStorage.getItem(PEOPLE_KEY)
    if (raw) return JSON.parse(raw) as Person[]
  } catch {
    /* ignora e cai no seed */
  }
  return SEED_PEOPLE.map((p) => ({ ...p }))
}

function delay(ms = 120) {
  return new Promise((res) => setTimeout(res, ms))
}

/**
 * Serviço ativo. Com `.env` preenchido (`hasSupabase`), usa o Supabase; senão, o mock
 * em memória. A UI consome sempre a mesma interface — não sabe qual está por baixo.
 */
export const notesService: NotesService = hasSupabase
  ? new SupabaseNotesService()
  : new MockNotesService()

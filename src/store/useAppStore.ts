import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Reminder, ReminderDraft, Settings, Status } from '@/types'
import { nowRoundedIso } from '@/lib/reminders'
import { GENERAL_SCOPE_ID } from '@/lib/constants'

/** Quadro de destino ao criar: o escopo "Geral" não é um container real → cai para Pessoal (null). */
function creationWorkspaceId(scope: string | null): string | null {
  return scope === GENERAL_SCOPE_ID ? null : scope
}

function blankDraft(kind: 'reminder' | 'doc' = 'reminder'): ReminderDraft {
  return {
    mode: 'new',
    id: null,
    title: '',
    body: '',
    color: '#FACC15',
    priority: 'normal',
    pinned: false,
    remindAt: null,
    recurrence: 'once',
    recurrenceRule: null,
    shares: [],
    tags: [],
    workspaceId: null,
    kind,
    checklist: [],
    ownedByMe: true,
    autoSnooze: false,
    snoozeIntervalMin: 10,
  }
}

/** Reconstrói o rascunho a partir de um lembrete/tarefa existente. */
function draftFrom(reminder: Reminder): ReminderDraft {
  return {
    mode: 'edit',
    id: reminder.id,
    title: reminder.title,
    body: reminder.body,
    color: reminder.color,
    priority: reminder.priority,
    pinned: reminder.pinned,
    remindAt: reminder.remindAt,
    recurrence: reminder.recurrence,
    recurrenceRule: reminder.recurrenceRule ?? null,
    shares: reminder.shares.slice(),
    tags: reminder.tags.slice(),
    workspaceId: reminder.workspaceId,
    kind: reminder.kind,
    checklist: reminder.checklist.map((c) => ({ ...c })),
    ownedByMe: reminder.mine,
    autoSnooze: reminder.autoSnooze,
    snoozeIntervalMin: reminder.snoozeIntervalMin,
  }
}

/** Perfil do usuário logado (mock na Fase 1; Fase 2 hidrata do Supabase Auth/profiles). */
export interface UserProfile {
  name: string
  /** Cor do avatar (uma das CARD_COLORS). */
  color: string
  /** Foto de perfil (URL pública no Storage; null = usa iniciais + cor). */
  avatarUrl?: string | null
}

interface AppState {
  // auth (mock na Fase 1; Supabase na Fase 2 dirige via setAuthed)
  authed: boolean
  login: () => void
  logout: () => void
  setAuthed: (v: boolean) => void

  // perfil do usuário (persistido; Fase 2: vem do Supabase)
  profile: UserProfile
  setProfile: (patch: Partial<UserProfile>) => void
  profileOpen: boolean
  openProfile: () => void
  closeProfile: () => void

  // painel de perfil de uma pessoa (Pessoas)
  selectedPersonId: string | null
  openPerson: (id: string) => void
  closePerson: () => void

  // presença (Realtime Presence) — ids dos usuários online agora
  onlineIds: string[]
  setOnlineIds: (ids: string[]) => void

  // quadro (workspace) ativo no mural — null = "Pessoal", GENERAL_SCOPE_ID = "Geral" (só leitura)
  activeWorkspaceId: string | null
  setActiveWorkspace: (id: string | null) => void

  // navegação do mural
  activeTab: Status
  setTab: (t: Status) => void
  query: string
  setQuery: (q: string) => void
  /** Visualização do mural: cards (masonry) ou lista compacta. */
  muralView: 'cards' | 'list'
  setMuralView: (v: 'cards' | 'list') => void

  // editor (lembretes)
  editorOpen: boolean
  draft: ReminderDraft
  openEditor: (reminder?: Reminder | null) => void
  closeEditor: () => void
  patchDraft: (patch: Partial<ReminderDraft>) => void

  // editor (tarefas — kind 'doc')
  taskOpen: boolean
  taskDraft: ReminderDraft
  openTask: (reminder?: Reminder | null) => void
  closeTask: () => void
  patchTask: (patch: Partial<ReminderDraft>) => void

  // modal de visualização de um lembrete (clique no card)
  viewId: string | null
  openView: (id: string) => void
  closeView: () => void

  // editor de blocos (kind 'block') — abre em cima de uma nota existente
  blockId: string | null
  openBlock: (id: string) => void
  closeBlock: () => void

  // disparo (overlay) — fila: vários lembretes no mesmo horário aparecem um de cada vez.
  triggerOpen: boolean
  triggerId: string | null
  /** Lembretes esperando atrás do atual (aparecem quando o da frente é fechado). */
  triggerQueue: (string | null)[]
  /** Como o último disparo foi fechado — o AutoSnooze usa para decidir se re-alerta. */
  triggerOutcome: TriggerOutcome | null
  /** Última ocorrência fechada (id+desfecho+seq) — o AutoSnooze reage a isto mesmo com fila. */
  lastClosed: { id: string; outcome: TriggerOutcome; seq: number } | null
  openTrigger: (id: string | null) => void
  closeTrigger: (outcome?: TriggerOutcome) => void

  // feedback
  toast: ToastState | null
  showToast: (message: string, action?: ToastAction) => void
  dismissToast: () => void

  // preferências
  settings: Settings
  toggleSetting: (key: keyof Settings) => void
  setSetting: (key: keyof Settings, value: boolean) => void
  setAccent: (hex: string) => void
  /** Escala da interface (zoom): 0.9 = compacto … 1.25 = grande. */
  setScale: (n: number) => void
  /** Intervalo padrão do auto-snooze (min) para lembretes novos. */
  setSnoozeInterval: (n: number) => void
  /** Tema: escuro / claro / seguir o sistema. */
  setTheme: (t: 'dark' | 'light' | 'system') => void
  /** Som do alarme (Android): URI + nome do toque escolhido no seletor do sistema. */
  setAlarmSound: (uri: string | null, name: string) => void
}

/** Desfecho de um disparo (para o auto-snooze): concluído, adiado, ou apenas dispensado. */
export type TriggerOutcome = 'done' | 'snoozed' | 'dismiss'

/** Ação opcional do toast (padrão snackbar: um botão "Desfazer"/"Ver"). */
export interface ToastAction {
  label: string
  run: () => void
}
export interface ToastState {
  message: string
  action?: ToastAction
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      authed: false,
      login: () => set({ authed: true }),
      logout: () => set({ authed: false }),
      setAuthed: (v) => set({ authed: v }),

      profile: { name: 'Você', color: '#FACC15', avatarUrl: null },
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      profileOpen: false,
      openProfile: () => set({ profileOpen: true }),
      closeProfile: () => set({ profileOpen: false }),

      selectedPersonId: null,
      openPerson: (id) => set({ selectedPersonId: id }),
      closePerson: () => set({ selectedPersonId: null }),

      onlineIds: [],
      setOnlineIds: (ids) => set({ onlineIds: ids }),

      activeWorkspaceId: GENERAL_SCOPE_ID, // abre no quadro Geral (visão agregada) por padrão
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  activeTab: 'active',
  setTab: (t) => set({ activeTab: t }),
  query: '',
  setQuery: (q) => set({ query: q }),
  muralView: 'cards',
  setMuralView: (v) => set({ muralView: v }),

  editorOpen: false,
  draft: blankDraft(),
  openEditor: (reminder) =>
    set({
      editorOpen: true,
      draft: reminder
        ? draftFrom(reminder)
        : // Novo lembrete: já abre com a data/hora atuais, no quadro ativo e com o padrão de auto-snooze.
          {
            ...blankDraft(),
            remindAt: nowRoundedIso(),
            workspaceId: creationWorkspaceId(get().activeWorkspaceId),
            autoSnooze: get().settings.autoSnooze,
            snoozeIntervalMin: get().settings.snoozeInterval,
          },
    }),
  closeEditor: () => set({ editorOpen: false }),
  patchDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

  taskOpen: false,
  taskDraft: blankDraft('doc'),
  openTask: (reminder) =>
    set({
      taskOpen: true,
      taskDraft: reminder
        ? draftFrom(reminder)
        : { ...blankDraft('doc'), workspaceId: creationWorkspaceId(get().activeWorkspaceId) }, // nova tarefa no quadro ativo
    }),
  closeTask: () => set({ taskOpen: false }),
  patchTask: (patch) => set((s) => ({ taskDraft: { ...s.taskDraft, ...patch } })),

  viewId: null,
  openView: (id) => set({ viewId: id }),
  closeView: () => set({ viewId: null }),

  blockId: null,
  openBlock: (id) => set({ blockId: id }),
  closeBlock: () => set({ blockId: null }),

  triggerOpen: false,
  triggerId: null,
  triggerQueue: [],
  triggerOutcome: null,
  lastClosed: null,
  openTrigger: (id) =>
    set((s) => {
      // Nada aberto → abre já. Já aberto → enfileira atrás (sem duplicar o atual nem a fila).
      if (!s.triggerOpen) return { triggerOpen: true, triggerId: id, triggerOutcome: null }
      if (id === s.triggerId || s.triggerQueue.includes(id)) return {}
      return { triggerQueue: [...s.triggerQueue, id] }
    }),
  closeTrigger: (outcome = 'dismiss') =>
    set((s) => {
      const closed = s.triggerId
      const lastClosed =
        closed != null ? { id: closed, outcome, seq: (s.lastClosed?.seq ?? 0) + 1 } : s.lastClosed
      // Tem alguém na fila → mostra o próximo (aparece "por trás"); senão, fecha.
      if (s.triggerQueue.length > 0) {
        const [next, ...rest] = s.triggerQueue
        return { triggerId: next, triggerQueue: rest, triggerOutcome: outcome, lastClosed }
      }
      return { triggerOpen: false, triggerId: null, triggerOutcome: outcome, lastClosed }
    }),

  toast: null,
  showToast: (message, action) => {
    set({ toast: { message, action } })
    clearTimeout(toastTimer)
    // Com ação (ex.: Desfazer) fica mais tempo em tela; sem ação, some rápido.
    toastTimer = setTimeout(() => set({ toast: null }), action ? 4200 : 2200)
  },
  dismissToast: () => {
    clearTimeout(toastTimer)
    set({ toast: null })
  },

      settings: { alarm: true, ontop: true, sound: false, presence: true, reduce: false, autostart: false, push: false, accent: '#FACC15', scale: 1, theme: 'dark', autoSnooze: false, snoozeInterval: 10, alarmSoundUri: null, alarmSoundName: 'Padrão do sistema' },
      toggleSetting: (key) =>
        set((s) => ({ settings: { ...s.settings, [key]: !s.settings[key] } })),
      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),
      setAccent: (hex) => set((s) => ({ settings: { ...s.settings, accent: hex } })),
      setScale: (n) => set((s) => ({ settings: { ...s.settings, scale: n } })),
      setSnoozeInterval: (n) => set((s) => ({ settings: { ...s.settings, snoozeInterval: n } })),
      setTheme: (t) => set((s) => ({ settings: { ...s.settings, theme: t } })),
      setAlarmSound: (uri, name) =>
        set((s) => ({ settings: { ...s.settings, alarmSoundUri: uri, alarmSoundName: name } })),
    }),
    {
      name: 'sb-notas.app.v1',
      // Só auth, perfil e preferências persistem; estado efêmero (editor/disparo/toast) não.
      partialize: (s) => ({ authed: s.authed, settings: s.settings, profile: s.profile, muralView: s.muralView }),
      // Deep-merge para blobs antigos herdarem chaves novas (ex.: autostart, profile.color).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}) },
          profile: { ...current.profile, ...(p.profile ?? {}) },
        }
      },
    },
  ),
)

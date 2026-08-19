import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Reminder, ReminderDraft, Settings, Status } from '@/types'
import { nowRoundedIso } from '@/lib/reminders'

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
    shares: [],
    tags: [],
    workspaceId: null,
    kind,
    checklist: [],
    ownedByMe: true,
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
    shares: reminder.shares.slice(),
    tags: reminder.tags.slice(),
    workspaceId: reminder.workspaceId,
    kind: reminder.kind,
    checklist: reminder.checklist.map((c) => ({ ...c })),
    ownedByMe: reminder.mine,
  }
}

/** Perfil do usuário logado (mock na Fase 1; Fase 2 hidrata do Supabase Auth/profiles). */
export interface UserProfile {
  name: string
  /** Cor do avatar (uma das CARD_COLORS). */
  color: string
}

interface AppState {
  // auth (mock na Fase 1; Supabase na Fase 2 dirige via setAuthed)
  authed: boolean
  login: () => void
  logout: () => void
  setAuthed: (v: boolean) => void

  // recuperação de senha (evento PASSWORD_RECOVERY do Supabase → tela de nova senha)
  recovering: boolean
  setRecovering: (v: boolean) => void

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

  // quadro (workspace) ativo no mural — null = "Pessoal"
  activeWorkspaceId: string | null
  setActiveWorkspace: (id: string | null) => void

  // navegação do mural
  activeTab: Status
  setTab: (t: Status) => void
  query: string
  setQuery: (q: string) => void

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

  // disparo (overlay)
  triggerOpen: boolean
  triggerId: string | null
  openTrigger: (id: string | null) => void
  closeTrigger: () => void

  // feedback
  toast: ToastState | null
  showToast: (message: string, action?: ToastAction) => void
  dismissToast: () => void

  // preferências
  settings: Settings
  toggleSetting: (key: keyof Settings) => void
  setSetting: (key: keyof Settings, value: boolean) => void
  setAccent: (hex: string) => void
}

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

      recovering: false,
      setRecovering: (v) => set({ recovering: v }),

      profile: { name: 'Sávio B.', color: '#FACC15' },
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      profileOpen: false,
      openProfile: () => set({ profileOpen: true }),
      closeProfile: () => set({ profileOpen: false }),

      selectedPersonId: null,
      openPerson: (id) => set({ selectedPersonId: id }),
      closePerson: () => set({ selectedPersonId: null }),

      onlineIds: [],
      setOnlineIds: (ids) => set({ onlineIds: ids }),

      activeWorkspaceId: null,
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  activeTab: 'active',
  setTab: (t) => set({ activeTab: t }),
  query: '',
  setQuery: (q) => set({ query: q }),

  editorOpen: false,
  draft: blankDraft(),
  openEditor: (reminder) =>
    set({
      editorOpen: true,
      draft: reminder
        ? draftFrom(reminder)
        : // Novo lembrete: já abre com a data/hora atuais e no quadro ativo.
          { ...blankDraft(), remindAt: nowRoundedIso(), workspaceId: get().activeWorkspaceId },
    }),
  closeEditor: () => set({ editorOpen: false }),
  patchDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

  taskOpen: false,
  taskDraft: blankDraft('doc'),
  openTask: (reminder) =>
    set({ taskOpen: true, taskDraft: reminder ? draftFrom(reminder) : blankDraft('doc') }),
  closeTask: () => set({ taskOpen: false }),
  patchTask: (patch) => set((s) => ({ taskDraft: { ...s.taskDraft, ...patch } })),

  viewId: null,
  openView: (id) => set({ viewId: id }),
  closeView: () => set({ viewId: null }),

  triggerOpen: false,
  triggerId: null,
  openTrigger: (id) => set({ triggerOpen: true, triggerId: id }),
  closeTrigger: () => set({ triggerOpen: false, triggerId: null }),

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

      settings: { alarm: true, ontop: true, sound: false, presence: true, reduce: false, autostart: false, push: false, accent: '#FACC15' },
      toggleSetting: (key) =>
        set((s) => ({ settings: { ...s.settings, [key]: !s.settings[key] } })),
      setSetting: (key, value) =>
        set((s) => ({ settings: { ...s.settings, [key]: value } })),
      setAccent: (hex) => set((s) => ({ settings: { ...s.settings, accent: hex } })),
    }),
    {
      name: 'sb-notas.app.v1',
      // Só auth, perfil e preferências persistem; estado efêmero (editor/disparo/toast) não.
      partialize: (s) => ({ authed: s.authed, settings: s.settings, profile: s.profile }),
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

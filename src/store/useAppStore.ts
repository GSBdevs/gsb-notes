import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Reminder, ReminderDraft, Settings, Status } from '@/types'

function blankDraft(): ReminderDraft {
  return {
    mode: 'new',
    id: null,
    title: '',
    body: '',
    color: '#FACC15',
    priority: 'normal',
    pinned: false,
    recurrence: 'once',
    shares: [],
  }
}

interface AppState {
  // auth (mock na Fase 1)
  authed: boolean
  login: () => void
  logout: () => void

  // navegação do mural
  activeTab: Status
  setTab: (t: Status) => void
  query: string
  setQuery: (q: string) => void

  // editor
  editorOpen: boolean
  draft: ReminderDraft
  openEditor: (reminder?: Reminder | null) => void
  closeEditor: () => void
  patchDraft: (patch: Partial<ReminderDraft>) => void

  // disparo (overlay)
  triggerOpen: boolean
  triggerId: string | null
  openTrigger: (id: string | null) => void
  closeTrigger: () => void

  // feedback
  toast: string
  showToast: (msg: string) => void

  // preferências
  settings: Settings
  toggleSetting: (key: keyof Settings) => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      authed: false,
      login: () => set({ authed: true }),
      logout: () => set({ authed: false }),

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
        ? {
            mode: 'edit',
            id: reminder.id,
            title: reminder.title,
            body: reminder.body,
            color: reminder.color,
            priority: reminder.priority,
            pinned: reminder.pinned,
            recurrence: reminder.recurrence,
            shares: reminder.shares.slice(),
          }
        : blankDraft(),
    }),
  closeEditor: () => set({ editorOpen: false }),
  patchDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),

  triggerOpen: false,
  triggerId: null,
  openTrigger: (id) => set({ triggerOpen: true, triggerId: id }),
  closeTrigger: () => set({ triggerOpen: false, triggerId: null }),

  toast: '',
  showToast: (msg) => {
    set({ toast: msg })
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: '' }), 2200)
  },

      settings: { alarm: true, ontop: true, sound: false, presence: true, reduce: false },
      toggleSetting: (key) =>
        set((s) => ({ settings: { ...s.settings, [key]: !s.settings[key] } })),
    }),
    {
      name: 'sb-notas.app.v1',
      // Só auth e preferências persistem; estado efêmero (editor/disparo/toast) não.
      partialize: (s) => ({ authed: s.authed, settings: s.settings }),
    },
  ),
)

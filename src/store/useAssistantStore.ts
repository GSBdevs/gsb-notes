import { create } from 'zustand'
import { aiService } from '@/services/aiService'
import type {
  AiChatMessage,
  AiEditResult,
  AiNoteItem,
  AiOrganizeResult,
  AiReminderProposal,
  AiSearchResult,
} from '@/types'

/**
 * Estado do Assistente de IA, FORA dos componentes de propósito: assim a conversa, as perguntas e os
 * resultados sobrevivem a sair/voltar da tela, e as chamadas continuam rodando em segundo plano
 * (a promise vive no store, não no componente). Ephemeral — não persiste em localStorage (reiniciar
 * o app zera, como o resto do estado efêmero do app). Segue o mesmo padrão Zustand de useAppStore.
 */

const nowTz = () => ({
  nowIso: new Date().toISOString(),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
})
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Falha ao falar com o assistente.')

export type AssistantMode = 'create' | 'edit' | 'organize' | 'search'

interface AssistantState {
  // modo ativo da aba (no store p/ não resetar ao sair da tela)
  mode: AssistantMode
  setMode: (m: AssistantMode) => void

  // ── Criar (mini-chat) ──
  chatInput: string
  chatMessages: AiChatMessage[]
  chatProposal: AiReminderProposal | null
  chatPending: boolean
  chatError: string | null
  setChatInput: (v: string) => void
  sendChat: () => void
  resetChat: () => void

  // ── Buscar (grounding) ──
  searchInput: string
  searchQuery: string
  searchResult: AiSearchResult | null
  searchPending: boolean
  searchError: string | null
  setSearchInput: (v: string) => void
  runSearch: () => void

  // ── Organizar (resumo + ações) ──
  organizeFocus: string
  organizeResult: AiOrganizeResult | null
  organizePending: boolean
  organizeError: string | null
  setOrganizeFocus: (v: string) => void
  runOrganize: (items: AiNoteItem[]) => void

  // ── Editar (por linguagem) ──
  editInput: string
  editResult: AiEditResult | null
  editPending: boolean
  editError: string | null
  setEditInput: (v: string) => void
  runEdit: (items: AiNoteItem[]) => void
  clearEdit: () => void
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  mode: 'create',
  setMode: (m) => set({ mode: m }),

  // ── Criar (mini-chat) ──
  chatInput: '',
  chatMessages: [],
  chatProposal: null,
  chatPending: false,
  chatError: null,
  setChatInput: (v) => set({ chatInput: v }),
  sendChat: () => {
    const text = get().chatInput.trim()
    if (!text || get().chatPending) return
    const messages: AiChatMessage[] = [...get().chatMessages, { role: 'user', text }]
    set({ chatMessages: messages, chatInput: '', chatPending: true, chatError: null })
    const { nowIso, tz } = nowTz()
    aiService
      .chatCreate(messages, nowIso, tz)
      .then((r) =>
        set((s) => ({
          chatMessages: [...s.chatMessages, { role: 'assistant', text: r.reply }],
          chatProposal: r.proposal,
          chatPending: false,
        })),
      )
      .catch((e) => set({ chatPending: false, chatError: errMsg(e) }))
  },
  resetChat: () => set({ chatInput: '', chatMessages: [], chatProposal: null, chatPending: false, chatError: null }),

  // ── Buscar ──
  searchInput: '',
  searchQuery: '',
  searchResult: null,
  searchPending: false,
  searchError: null,
  setSearchInput: (v) => set({ searchInput: v }),
  runSearch: () => {
    const text = get().searchInput.trim()
    if (!text || get().searchPending) return
    set({ searchQuery: text, searchPending: true, searchError: null, searchResult: null })
    const { nowIso, tz } = nowTz()
    aiService
      .searchWeb(text, nowIso, tz)
      .then((r) => set({ searchResult: r, searchPending: false }))
      .catch((e) => set({ searchPending: false, searchError: errMsg(e) }))
  },

  // ── Organizar ──
  organizeFocus: '',
  organizeResult: null,
  organizePending: false,
  organizeError: null,
  setOrganizeFocus: (v) => set({ organizeFocus: v }),
  runOrganize: (items) => {
    if (items.length === 0 || get().organizePending) return
    set({ organizePending: true, organizeError: null })
    const { nowIso, tz } = nowTz()
    aiService
      .organizeItems(items, nowIso, tz, get().organizeFocus.trim() || undefined)
      .then((r) => set({ organizeResult: r, organizePending: false }))
      .catch((e) => set({ organizePending: false, organizeError: errMsg(e) }))
  },

  // ── Editar ──
  editInput: '',
  editResult: null,
  editPending: false,
  editError: null,
  setEditInput: (v) => set({ editInput: v }),
  runEdit: (items) => {
    const text = get().editInput.trim()
    if (!text || items.length === 0 || get().editPending) return
    set({ editPending: true, editError: null, editResult: null })
    const { nowIso, tz } = nowTz()
    aiService
      .editReminder(text, items, nowIso, tz)
      .then((r) => set({ editResult: r, editPending: false }))
      .catch((e) => set({ editPending: false, editError: errMsg(e) }))
  },
  clearEdit: () => set({ editResult: null, editError: null }),
}))

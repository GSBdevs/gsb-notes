import { supabase, hasSupabase } from './supabase'
import type {
  AiChatMessage,
  AiChatResult,
  AiEditResult,
  AiNoteItem,
  AiOrganizeResult,
  AiReminderProposal,
  AiSearchResult,
  Priority,
  Recurrence,
} from '@/types'

/**
 * Ferramenta de IA (teste, SÓ MASTER). A IA nunca grava: devolve propostas/ações que o app aplica
 * pelo fluxo normal (notesService), com confirmação. A chave do provedor fica na Edge Function
 * `ai-assistant`, nunca aqui. Segue a regra de arquitetura: a UI não fala com o backend direto.
 */
export interface AiService {
  /** Mini-chat para montar um lembrete conversando. Devolve resposta + proposta corrente. */
  chatCreate(messages: AiChatMessage[], nowIso: string, tz: string): Promise<AiChatResult>
  /** Edita um item existente por linguagem natural: identifica o alvo e os campos que mudam. */
  editReminder(instruction: string, items: AiNoteItem[], nowIso: string, tz: string): Promise<AiEditResult>
  /** Resumo + ações concretas (repriorizar/agendar) sobre os itens ativos. */
  organizeItems(items: AiNoteItem[], nowIso: string, tz: string, focus?: string): Promise<AiOrganizeResult>
  /** Responde uma pergunta aberta com busca na web (grounding). Envia só a pergunta. */
  searchWeb(prompt: string, nowIso: string, tz: string): Promise<AiSearchResult>
}

const TIMEOUT_MS = 45_000

/** Promise com teto de tempo: evita a tela "pendurada" se o modelo demorar demais. */
function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('A IA demorou demais. Tente de novo.')), ms),
    ),
  ])
}

interface FnOk {
  ok?: boolean
  error?: string
  [k: string]: unknown
}

/** Invoca a Edge Function (com timeout) e devolve o corpo já validado (ok === true). */
async function invokeFn(body: Record<string, unknown>): Promise<FnOk> {
  if (!supabase) throw new Error('Backend indisponível.')
  const { data, error } = await withTimeout(supabase.functions.invoke('ai-assistant', { body }), TIMEOUT_MS)
  if (error) throw new Error(await extractFnError(error))
  const res = data as FnOk | null
  if (!res?.ok) throw new Error(res?.error || 'O assistente não respondeu.')
  return res
}

/** Normaliza a proposta vinda da function para o tipo do app. */
function mapProposal(p: unknown): AiReminderProposal {
  const o = (p ?? {}) as Partial<AiReminderProposal>
  return {
    title: o.title ?? '',
    body: o.body ?? '',
    remindAt: o.remindAt ?? null,
    priority: (o.priority as Priority) ?? 'normal',
    recurrence: (o.recurrence as Recurrence) ?? 'once',
    tags: Array.isArray(o.tags) ? o.tags : [],
  }
}

class SupabaseAiService implements AiService {
  async chatCreate(messages: AiChatMessage[], nowIso: string, tz: string): Promise<AiChatResult> {
    const res = await invokeFn({ mode: 'chat', messages, nowIso, tz })
    return { reply: String(res.reply ?? ''), proposal: mapProposal(res.proposal) }
  }

  async editReminder(
    instruction: string,
    items: AiNoteItem[],
    nowIso: string,
    tz: string,
  ): Promise<AiEditResult> {
    const res = await invokeFn({ mode: 'edit', prompt: instruction, items, nowIso, tz })
    const edit = (res.edit ?? {}) as Partial<AiEditResult>
    return {
      targetId: edit.targetId ?? '',
      patch: edit.patch ?? {},
      note: edit.note ?? '',
    }
  }

  async organizeItems(
    items: AiNoteItem[],
    nowIso: string,
    tz: string,
    focus?: string,
  ): Promise<AiOrganizeResult> {
    const res = await invokeFn({ mode: 'organize', items, nowIso, tz, prompt: focus ?? '' })
    return {
      summary: String(res.summary ?? ''),
      actions: Array.isArray(res.actions) ? (res.actions as AiOrganizeResult['actions']) : [],
    }
  }

  async searchWeb(prompt: string, nowIso: string, tz: string): Promise<AiSearchResult> {
    const res = await invokeFn({ mode: 'search', prompt, nowIso, tz })
    return {
      answer: String(res.answer ?? ''),
      sources: Array.isArray(res.sources) ? (res.sources as AiSearchResult['sources']) : [],
    }
  }
}

/** Mock (sem backend): não há master no modo single-user, então a tela nem aparece. */
class MockAiService implements AiService {
  async chatCreate(): Promise<AiChatResult> {
    throw new Error('O assistente de IA precisa do backend.')
  }
  async editReminder(): Promise<AiEditResult> {
    throw new Error('O assistente de IA precisa do backend.')
  }
  async organizeItems(): Promise<AiOrganizeResult> {
    throw new Error('O assistente de IA precisa do backend.')
  }
  async searchWeb(): Promise<AiSearchResult> {
    throw new Error('O assistente de IA precisa do backend.')
  }
}

/**
 * Extrai o motivo real de um erro do functions.invoke. O corpo { error, detail } vem no Response em
 * `error.context`; se não der para ler, cai na mensagem genérica do supabase-js.
 */
async function extractFnError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown })?.context
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: string; detail?: string }
      const msg = body?.error || ''
      return body?.detail ? `${msg} — ${body.detail}` : msg || fallbackMsg(error)
    } catch {
      /* corpo não-JSON */
    }
  }
  return fallbackMsg(error)
}

function fallbackMsg(error: unknown): string {
  const m = error instanceof Error ? error.message : String(error)
  // A genérica do supabase-js não ajuda ninguém; troca por algo acionável.
  if (/non-2xx/i.test(m))
    return 'O assistente falhou. Verifique se a Edge Function foi deployada e se a chave do Gemini está configurada.'
  return m || 'Falha ao chamar o assistente.'
}

export const aiService: AiService = hasSupabase ? new SupabaseAiService() : new MockAiService()

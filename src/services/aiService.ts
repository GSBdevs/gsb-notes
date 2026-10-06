import { supabase, hasSupabase } from './supabase'
import type { AiReminderProposal, AiSummaryItem, Priority, Recurrence } from '@/types'

/**
 * Ferramenta de IA (teste, SÓ MASTER). Transforma um pedido em linguagem natural numa PROPOSTA de
 * lembrete — a IA nunca grava. O app abre o editor pré-preenchido e o usuário confirma/salva pelo
 * fluxo normal (notesService). A chave do provedor fica na Edge Function `ai-assistant`, nunca aqui.
 *
 * Segue a regra de arquitetura: a UI não fala com o backend direto; passa por este serviço.
 */
export interface AiService {
  /** Pede uma proposta de lembrete a partir de texto livre. `nowIso`/`tz` resolvem datas relativas. */
  proposeReminder(prompt: string, nowIso: string, tz: string): Promise<AiReminderProposal>
  /** Resume/organiza uma lista de itens do usuário (só leitura). `focus` é um recorte opcional. */
  summarizeItems(items: AiSummaryItem[], nowIso: string, tz: string, focus?: string): Promise<string>
}

interface ProposalResponse {
  ok?: boolean
  error?: string
  proposal?: {
    title?: string
    body?: string
    remindAt?: string | null
    priority?: Priority
    recurrence?: Recurrence
    tags?: string[]
  }
}

class SupabaseAiService implements AiService {
  async proposeReminder(prompt: string, nowIso: string, tz: string): Promise<AiReminderProposal> {
    if (!supabase) throw new Error('Backend indisponível.')
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { prompt, nowIso, tz },
    })
    if (error) {
      // FunctionsHttpError: a function respondeu non-2xx e o supabase-js esconde o corpo na mensagem
      // genérica "Edge Function returned a non-2xx status code". O { error, detail } real está no
      // Response em error.context — lemos para mostrar o motivo de verdade.
      throw new Error(await extractFnError(error))
    }
    const res = data as ProposalResponse | null
    if (!res?.ok || !res.proposal) throw new Error(res?.error || 'O assistente não respondeu.')
    const p = res.proposal
    return {
      title: p.title ?? '',
      body: p.body ?? '',
      remindAt: p.remindAt ?? null,
      priority: p.priority ?? 'normal',
      recurrence: p.recurrence ?? 'once',
      tags: Array.isArray(p.tags) ? p.tags : [],
    }
  }

  async summarizeItems(items: AiSummaryItem[], nowIso: string, tz: string, focus?: string): Promise<string> {
    if (!supabase) throw new Error('Backend indisponível.')
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { mode: 'summarize', items, nowIso, tz, prompt: focus ?? '' },
    })
    if (error) throw new Error(await extractFnError(error))
    const res = data as { ok?: boolean; error?: string; summary?: string } | null
    if (!res?.ok || !res.summary) throw new Error(res?.error || 'O assistente não respondeu.')
    return res.summary
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
  if (/non-2xx/i.test(m)) return 'O assistente falhou. Verifique se a Edge Function foi deployada e se a chave do Gemini está configurada.'
  return m || 'Falha ao chamar o assistente.'
}

/** Mock (sem backend): não há master no modo single-user, então a tela nem aparece. */
class MockAiService implements AiService {
  async proposeReminder(): Promise<AiReminderProposal> {
    throw new Error('O assistente de IA precisa do backend.')
  }
  async summarizeItems(): Promise<string> {
    throw new Error('O assistente de IA precisa do backend.')
  }
}

export const aiService: AiService = hasSupabase ? new SupabaseAiService() : new MockAiService()

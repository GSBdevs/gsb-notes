import { useMutation } from '@tanstack/react-query'
import { aiService } from '@/services/aiService'
import type { AiReminderProposal, AiSummaryItem } from '@/types'

const nowTz = () => ({
  nowIso: new Date().toISOString(),
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
})

/**
 * Pede ao assistente (Edge Function `ai-assistant`, só master) uma proposta de lembrete a partir de
 * texto livre. Envia o instante atual + fuso para resolver datas relativas ("amanhã", "sexta 14h").
 * Não grava nada: a tela usa o resultado para abrir o editor pré-preenchido.
 */
export function useProposeReminder() {
  return useMutation<AiReminderProposal, Error, string>({
    mutationFn: (prompt: string) => {
      const { nowIso, tz } = nowTz()
      return aiService.proposeReminder(prompt, nowIso, tz)
    },
  })
}

/**
 * Pede ao assistente um resumo/organização dos itens do usuário (só leitura — a IA não grava).
 * A tela monta a lista compacta (`items`) e passa um `focus` opcional.
 */
export function useSummarizeItems() {
  return useMutation<string, Error, { items: AiSummaryItem[]; focus?: string }>({
    mutationFn: ({ items, focus }) => {
      const { nowIso, tz } = nowTz()
      return aiService.summarizeItems(items, nowIso, tz, focus)
    },
  })
}

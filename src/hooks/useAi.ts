import { useMutation } from '@tanstack/react-query'
import { aiService } from '@/services/aiService'
import type { AiReminderProposal } from '@/types'

/**
 * Pede ao assistente (Edge Function `ai-assistant`, só master) uma proposta de lembrete a partir de
 * texto livre. Envia o instante atual + fuso para resolver datas relativas ("amanhã", "sexta 14h").
 * Não grava nada: a tela usa o resultado para abrir o editor pré-preenchido.
 */
export function useProposeReminder() {
  return useMutation<AiReminderProposal, Error, string>({
    mutationFn: (prompt: string) => {
      const nowIso = new Date().toISOString()
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
      return aiService.proposeReminder(prompt, nowIso, tz)
    },
  })
}

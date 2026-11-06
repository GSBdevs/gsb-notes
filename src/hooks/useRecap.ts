import { useMutation } from '@tanstack/react-query'
import { aiService } from '@/services/aiService'

/**
 * Resumo motivador dos concluídos (IA, só master). Recebe as estatísticas JÁ calculadas no cliente
 * (total, últimos dias, streak, destaques) — manda só agregados, não a lista de itens.
 */
export function useRecap() {
  return useMutation<string, Error, Record<string, unknown>>({
    mutationFn: (stats) => {
      const nowIso = new Date().toISOString()
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
      return aiService.recap(stats, nowIso, tz)
    },
  })
}

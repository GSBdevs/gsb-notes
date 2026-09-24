/**
 * Ordem dos chips de quadro no seletor — arrastar-e-mover, guardada POR DISPOSITIVO (localStorage).
 * Não sincroniza entre aparelhos (decisão do dono). Ids desconhecidos (quadros novos) vão para o fim.
 */
const KEY = 'sb-notas.workspace-order.v1'

export function loadWorkspaceOrder(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function saveWorkspaceOrder(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    /* localStorage indisponível: ordem só nesta sessão */
  }
}

/** Ordena `list` pela ordem salva; ids fora da ordem mantêm a posição relativa original, ao fim. */
export function orderWorkspaces<T extends { id: string }>(list: T[], order: string[]): T[] {
  if (!order.length) return list
  const idx = new Map(order.map((id, i) => [id, i]))
  return list
    .map((w, i) => ({ w, i, o: idx.has(w.id) ? (idx.get(w.id) as number) : Infinity }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((x) => x.w)
}

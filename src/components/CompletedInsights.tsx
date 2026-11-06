import { useMemo } from 'react'
import { useReminders } from '@/hooks/useReminders'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useMyRole } from '@/hooks/useAdmin'
import { useRecap } from '@/hooks/useRecap'
import { Icon } from '@/components/ui/Icon'

/** Chave de dia local (YYYY-MM-DD) a partir de um ISO. */
function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
/** Sequência de dias (terminando hoje ou ontem) com ao menos 1 conclusão. */
function computeStreak(keys: Set<string>): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const k = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  if (!keys.has(k(d))) d.setDate(d.getDate() - 1) // permite streak que terminou ontem
  let n = 0
  while (keys.has(k(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

const PRIO_LABEL: Record<string, string> = { normal: 'Normal', important: 'Importante', urgent: 'Urgente' }

/**
 * Painel de métricas da aba "Concluídos" — ferramenta de TESTE, exclusiva da conta MASTER
 * (ver memória ferramenta-teste-master-only). Fora do master retorna null, então a aba Concluídos
 * fica EXATAMENTE como hoje para todos os outros. Agrega lembretes + tarefas MINHAS já concluídas
 * (status archived). Métricas por tempo usam `completed_at` (migração 0031) — itens arquivados antes
 * dela ficam sem data (contam no total, fora das tendências). Resumo em linguagem natural é opcional
 * (botão) e reusa o assistente de IA.
 */
export function CompletedInsights() {
  const { data: role } = useMyRole()
  const { data: reminders = [] } = useReminders()
  const { data: workspaces = [] } = useWorkspaces()
  const recap = useRecap()

  const stats = useMemo(() => {
    const done = reminders.filter(
      (r) => r.mine && r.status === 'archived' && (r.kind === 'reminder' || r.kind === 'doc'),
    )
    const withTime = done.filter((r) => !!r.completedAt)
    const now = Date.now()
    const DAY = 86_400_000
    const inLast = (d: number) => withTime.filter((r) => now - new Date(r.completedAt!).getTime() <= d * DAY).length

    // Últimos 7 dias (barras): hoje por último.
    const byDay = new Map<string, number>()
    for (const r of withTime) byDay.set(dayKey(r.completedAt!), (byDay.get(dayKey(r.completedAt!)) ?? 0) + 1)
    const days: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * DAY)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      days.push({ label: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), count: byDay.get(key) ?? 0 })
    }

    const byPrio = { normal: 0, important: 0, urgent: 0 }
    const byPasta = new Map<string, number>()
    const byTag = new Map<string, number>()
    for (const r of done) {
      byPrio[r.priority] = (byPrio[r.priority] ?? 0) + 1
      const pastaName = r.workspaceId ? (workspaces.find((w) => w.id === r.workspaceId)?.name ?? 'Pasta') : 'Pessoal'
      byPasta.set(pastaName, (byPasta.get(pastaName) ?? 0) + 1)
      for (const t of r.tags) byTag.set(t, (byTag.get(t) ?? 0) + 1)
    }
    const top = (m: Map<string, number>) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, n]) => ({ name, n }))

    return {
      total: done.length,
      withTimeCount: withTime.length,
      last7: inLast(7),
      last30: inLast(30),
      streak: computeStreak(new Set(withTime.map((r) => dayKey(r.completedAt!)))),
      days,
      maxDay: Math.max(1, ...days.map((d) => d.count)),
      byPrio,
      topPastas: top(byPasta),
      topTags: top(byTag),
      tarefas: done.filter((r) => r.kind === 'doc').length,
      lembretes: done.filter((r) => r.kind === 'reminder').length,
    }
  }, [reminders, workspaces])

  // Fora do master, ou sem nada concluído: nada muda na aba (fica como hoje).
  if (role !== 'master' || stats.total === 0) return null

  const genRecap = () => {
    if (recap.isPending) return
    recap.mutate({
      total: stats.total,
      ultimos7dias: stats.last7,
      ultimos30dias: stats.last30,
      sequenciaDias: stats.streak,
      porPrioridade: stats.byPrio,
      topPastas: stats.topPastas,
      topEtiquetas: stats.topTags,
      tarefas: stats.tarefas,
      lembretes: stats.lembretes,
    })
  }

  return (
    <div className="mb-5 rounded-xl border border-border bg-bg-elevated p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon name="check-circle" size={16} style={{ color: 'var(--success)' }} />
        <h3 className="text-[14px] font-bold tracking-[-.01em]">Resumo dos concluídos</h3>
        <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-surface px-2 py-0.5 text-[10.5px] font-semibold text-accent-ink">
          Teste
        </span>
      </div>

      {/* Números-chave */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total" value={stats.total} />
        <StatTile label="Últimos 7 dias" value={stats.last7} />
        <StatTile label="Últimos 30 dias" value={stats.last30} />
        <StatTile label="Sequência" value={stats.streak} suffix={stats.streak === 1 ? 'dia' : 'dias'} />
      </div>

      {/* Mini-gráfico dos últimos 7 dias */}
      <div className="mt-4">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-text-muted">
          Últimos 7 dias
        </div>
        <div className="flex items-end gap-1.5" style={{ height: 64 }}>
          {stats.days.map((d, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${(d.count / stats.maxDay) * 100}%`,
                    minHeight: d.count > 0 ? 4 : 0,
                    background: 'var(--accent)',
                  }}
                  title={`${d.count} concluído(s)`}
                />
              </div>
              <span className="text-[10px] text-text-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quebras */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Breakdown
          title="Prioridade"
          rows={[
            { name: PRIO_LABEL.urgent, n: stats.byPrio.urgent },
            { name: PRIO_LABEL.important, n: stats.byPrio.important },
            { name: PRIO_LABEL.normal, n: stats.byPrio.normal },
          ].filter((r) => r.n > 0)}
        />
        <Breakdown title="Pastas" rows={stats.topPastas} />
        <Breakdown title="Etiquetas" rows={stats.topTags} emptyLabel="sem etiquetas" />
      </div>

      {stats.withTimeCount < stats.total && (
        <p className="mt-3 text-[11.5px] text-text-muted">
          As métricas por tempo contam a partir de agora — itens concluídos antes da atualização não têm data.
        </p>
      )}

      {/* Resumo da IA (sob demanda) */}
      <div className="mt-4 border-t border-border pt-3">
        {recap.data ? (
          <div className="flex items-start gap-2 text-[13.5px] leading-relaxed text-text-secondary">
            <Icon name="sparkles" size={15} className="mt-0.5 flex-none" style={{ color: 'var(--accent)' }} />
            <span className="whitespace-pre-wrap">{recap.data}</span>
          </div>
        ) : (
          <button
            onClick={genRecap}
            disabled={recap.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-bg-base px-3.5 text-[13px] font-semibold text-text-secondary transition-colors hover:border-accent hover:text-accent-ink disabled:opacity-60"
          >
            {recap.isPending ? <Icon name="loader-2" size={15} className="animate-spin" /> : <Icon name="sparkles" size={15} />}
            {recap.isPending ? 'Gerando…' : 'Resumo da semana (IA)'}
          </button>
        )}
        {recap.isError && (
          <p className="mt-2 text-[12.5px] text-danger">{recap.error?.message ?? 'Falha ao gerar o resumo.'}</p>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-base px-3 py-2.5">
      <div className="text-[22px] font-extrabold leading-none tracking-[-.02em] text-text-primary">
        {value}
        {suffix && <span className="ml-1 text-[12px] font-semibold text-text-muted">{suffix}</span>}
      </div>
      <div className="mt-1 text-[11.5px] text-text-muted">{label}</div>
    </div>
  )
}

function Breakdown({
  title,
  rows,
  emptyLabel = '—',
}: {
  title: string
  rows: { name: string; n: number }[]
  emptyLabel?: string
}) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-text-muted">{title}</div>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-text-muted">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-2 text-[12.5px]">
              <span className="min-w-0 truncate text-text-secondary">{r.name}</span>
              <span className="flex-none font-semibold text-text-primary">{r.n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

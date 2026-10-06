import { useMemo, useState } from 'react'
import type { AiSummaryItem } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { useMyRole } from '@/hooks/useAdmin'
import { useProposeReminder, useSummarizeItems } from '@/hooks/useAi'
import { useReminders } from '@/hooks/useReminders'
import { Icon } from '@/components/ui/Icon'

/** Exemplos clicáveis — só dados fictícios (ferramenta de teste; o free tier do provedor pode treinar). */
const EXAMPLES = [
  'Pagar a conta de luz sexta às 14h, urgente',
  'Reunião com o time toda segunda às 9h',
  'Comprar presente de aniversário até dia 20',
  'Tomar remédio todo dia às 8h e às 20h',
]

type Mode = 'create' | 'summarize'

/**
 * Assistente de IA — ferramenta de TESTE, exclusiva da conta MASTER (ver memória
 * ferramenta-teste-master-only). Dois modos: "Criar lembrete" (linguagem natural → proposta que
 * pré-preenche o editor) e "Resumir tarefas" (a IA lê seus itens ativos e devolve um resumo
 * organizado, só leitura). A IA nunca grava. Edge Function `ai-assistant` → Gemini.
 */
export function AssistantScreen() {
  const { data: role, isLoading: roleLoading } = useMyRole()
  const isMaster = role === 'master'
  const [mode, setMode] = useState<Mode>('create')

  if (roleLoading) return <p className="px-1 py-10 text-sm text-text-muted">Carregando…</p>
  if (!isMaster) {
    return (
      <div className="flex flex-col items-center justify-center px-5 py-16 text-center text-text-secondary">
        <div className="mb-[18px] grid h-16 w-16 place-items-center rounded-full bg-bg-elevated text-text-muted">
          <Icon name="alert-triangle" size={26} />
        </div>
        <h3 className="mb-1.5 text-[17px] font-semibold text-text-primary">Acesso restrito</h3>
        <p className="max-w-[340px] text-sm">Esta área é exclusiva da conta master.</p>
      </div>
    )
  }

  return (
    <div className="max-w-[680px]">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-[-.01em]">Assistente</h2>
          <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent-surface px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
            <Icon name="sparkles" size={11} /> Teste
          </span>
        </div>
        <p className="mt-0.5 text-[13px] text-text-muted">
          {mode === 'create'
            ? 'Descreva um lembrete em linguagem natural. A IA monta uma proposta — você revisa e salva.'
            : 'A IA lê seus itens ativos e devolve um resumo organizado. Nada é alterado.'}
        </p>
      </div>

      {/* Alternador de modo */}
      <div className="mb-4 inline-flex rounded-md border border-border bg-bg-base p-0.5">
        {(['create', 'summarize'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-[5px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              mode === m ? 'bg-accent text-text-on-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {m === 'create' ? 'Criar lembrete' : 'Resumir tarefas'}
          </button>
        ))}
      </div>

      {mode === 'create' ? <CreatePanel /> : <SummarizePanel />}

      <div className="mt-6 flex items-start gap-2 rounded-md border border-border bg-bg-base px-3 py-2.5 text-[12.5px] text-text-muted">
        <Icon name="shield" size={14} className="mt-px flex-none" />
        <span>
          Ferramenta de teste (só master). Use dados fictícios — o provedor gratuito pode usar o
          conteúdo enviado para treino.
        </span>
      </div>
    </div>
  )
}

/** Modo "Criar lembrete": texto livre → proposta que abre o editor pré-preenchido. */
function CreatePanel() {
  const openEditorWithDraft = useAppStore((s) => s.openEditorWithDraft)
  const showToast = useAppStore((s) => s.showToast)
  const propose = useProposeReminder()
  const [prompt, setPrompt] = useState('')

  const generate = () => {
    const text = prompt.trim()
    if (!text || propose.isPending) return
    propose.mutate(text, {
      onSuccess: (p) => {
        openEditorWithDraft({
          title: p.title,
          body: p.body,
          remindAt: p.remindAt,
          priority: p.priority,
          recurrence: p.recurrence,
          tags: p.tags,
        })
        showToast('Proposta pronta — revise e salve')
      },
    })
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-bg-elevated p-3.5">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              generate()
            }
          }}
          rows={3}
          placeholder="Ex.: lembrar de pagar a conta de luz sexta às 14h, urgente"
          className="min-h-[76px] w-full resize-y rounded-md border border-border bg-bg-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="hidden text-[11.5px] text-text-muted sm:inline">Ctrl + Enter para gerar</span>
          <button
            onClick={generate}
            disabled={!prompt.trim() || propose.isPending}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {propose.isPending ? (
              <Icon name="loader-2" size={16} className="animate-spin" />
            ) : (
              <Icon name="sparkles" size={16} />
            )}
            {propose.isPending ? 'Gerando…' : 'Gerar lembrete'}
          </button>
        </div>
      </div>

      {propose.isError && <ErrorBox message={propose.error?.message} />}

      <div className="mt-5">
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-[.04em] text-text-muted">
          Exemplos
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              disabled={propose.isPending}
              className="rounded-full border border-border bg-bg-base px-3 py-1.5 text-[12.5px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

/** Modo "Resumir tarefas": monta a lista compacta dos itens ativos e pede um resumo (só leitura). */
function SummarizePanel() {
  const { data: reminders = [] } = useReminders()
  const summarize = useSummarizeItems()
  const [focus, setFocus] = useState('')

  // Itens ativos (lembretes + tarefas); sem corpo, só o essencial. Teto no cliente e na function.
  const items = useMemo<AiSummaryItem[]>(
    () =>
      reminders
        .filter((r) => (r.kind === 'reminder' || r.kind === 'doc') && r.status !== 'archived')
        .slice(0, 80)
        .map((r) => ({
          kind: r.kind as 'reminder' | 'doc',
          title: r.title,
          priority: r.priority,
          remindAt: r.remindAt,
          done: false,
          ...(r.kind === 'doc'
            ? {
                checklistDone: r.checklist.filter((c) => c.done).length,
                checklistTotal: r.checklist.length,
              }
            : {}),
        })),
    [reminders],
  )

  const run = () => {
    if (items.length === 0 || summarize.isPending) return
    summarize.mutate({ items, focus: focus.trim() || undefined })
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-bg-elevated p-3.5">
        <input
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              run()
            }
          }}
          placeholder="Foco (opcional) — ex.: o que é mais urgente?"
          className="h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-text-muted">
            {items.length === 0 ? 'Nenhum item ativo' : `${items.length} ${items.length === 1 ? 'item' : 'itens'} ativos`}
          </span>
          <button
            onClick={run}
            disabled={items.length === 0 || summarize.isPending}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {summarize.isPending ? (
              <Icon name="loader-2" size={16} className="animate-spin" />
            ) : (
              <Icon name="list-todo" size={16} />
            )}
            {summarize.isPending ? 'Resumindo…' : 'Resumir'}
          </button>
        </div>
      </div>

      {summarize.isError && <ErrorBox message={summarize.error?.message} />}

      {summarize.data && (
        <div className="mt-4 rounded-lg border border-border bg-bg-elevated p-4">
          <div className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[.04em] text-text-muted">
            <Icon name="sparkles" size={12} /> Resumo
          </div>
          <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-secondary">
            {summarize.data}
          </div>
        </div>
      )}
    </>
  )
}

function ErrorBox({ message }: { message?: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-[#ef444480] bg-[#ef44441a] px-3 py-2.5 text-[13px] font-medium text-danger">
      <Icon name="alert-triangle" size={15} className="mt-px flex-none" />
      <span>{message ?? 'Falha ao falar com o assistente.'}</span>
    </div>
  )
}

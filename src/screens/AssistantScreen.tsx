import { useMemo } from 'react'
import type { AiNoteItem, AiReminderPatch } from '@/types'
import { useAppStore } from '@/store/useAppStore'
import { useAssistantStore } from '@/store/useAssistantStore'
import { useMyRole } from '@/hooks/useAdmin'
import { useReminders } from '@/hooks/useReminders'
import { Icon } from '@/components/ui/Icon'

type Mode = 'create' | 'edit' | 'organize' | 'search'

const MODE_LABEL: Record<Mode, string> = {
  create: 'Criar',
  edit: 'Editar',
  organize: 'Organizar',
  search: 'Buscar',
}
const MODE_HINT: Record<Mode, string> = {
  create: 'Monte um lembrete conversando. Quando a proposta estiver boa, abra no editor e salve.',
  edit: 'Diga o que mudar num item existente ("adie a reunião pra sexta"). Abre o item pra você confirmar.',
  organize: 'A IA resume seus itens ativos e sugere ações (repriorizar, agendar) que você aplica com 1 toque.',
  search: 'Pergunta aberta respondida com busca na web (com fontes). Envia só a pergunta, nenhum dado seu.',
}
const PRIO_LABEL: Record<string, string> = { normal: 'Normal', important: 'Importante', urgent: 'Urgente' }
const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'sem horário'

/**
 * Assistente de IA — ferramenta de TESTE, exclusiva da conta MASTER. Quatro modos: Criar (mini-chat),
 * Editar (por linguagem), Organizar (resumo + ações) e Buscar (grounding). A IA nunca grava — tudo
 * passa pela confirmação no editor. O estado vive em useAssistantStore (sobrevive a sair da tela e as
 * chamadas seguem em background). O modo escolhido é efêmero local (não importa persistir).
 */
export function AssistantScreen() {
  const { data: role, isLoading: roleLoading } = useMyRole()
  const isMaster = role === 'master'
  const [mode, setMode] = useModeState()

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
        <p className="mt-0.5 text-[13px] text-text-muted">{MODE_HINT[mode]}</p>
      </div>

      <div className="mb-4 inline-flex flex-wrap rounded-md border border-border bg-bg-base p-0.5">
        {(['create', 'edit', 'organize', 'search'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-[5px] px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              mode === m ? 'bg-accent text-text-on-accent' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {MODE_LABEL[m]}
          </button>
        ))}
      </div>

      {mode === 'create' ? (
        <ChatPanel />
      ) : mode === 'edit' ? (
        <EditPanel />
      ) : mode === 'organize' ? (
        <OrganizePanel />
      ) : (
        <SearchPanel />
      )}

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

/** Modo selecionado — guardado no store para também sobreviver à navegação. */
function useModeState() {
  // Reaproveita o próprio store do assistente para o modo ativo não resetar ao sair da tela.
  const mode = useAssistantStore((s) => s.mode)
  const setMode = useAssistantStore((s) => s.setMode)
  return [mode, setMode] as const
}

/** Itens ativos (lembretes + tarefas) em forma compacta, com id — base do Editar e do Organizar. */
function useNoteItems(): AiNoteItem[] {
  const { data: reminders = [] } = useReminders()
  return useMemo(
    () =>
      reminders
        .filter((r) => (r.kind === 'reminder' || r.kind === 'doc') && r.status !== 'archived')
        .slice(0, 80)
        .map((r) => ({
          id: r.id,
          kind: r.kind as 'reminder' | 'doc',
          title: r.title,
          priority: r.priority,
          remindAt: r.remindAt,
          recurrence: r.recurrence,
          ...(r.kind === 'doc'
            ? { checklistDone: r.checklist.filter((c) => c.done).length, checklistTotal: r.checklist.length }
            : {}),
        })),
    [reminders],
  )
}

/** Modo "Criar": mini-chat (estado no store → conversa persiste e roda em background). */
function ChatPanel() {
  const openEditorWithDraft = useAppStore((s) => s.openEditorWithDraft)
  const showToast = useAppStore((s) => s.showToast)
  const {
    chatInput,
    chatMessages,
    chatProposal,
    chatPending,
    chatError,
    setChatInput,
    sendChat,
    resetChat,
  } = useAssistantStore()

  const openInEditor = () => {
    if (!chatProposal?.title) return
    openEditorWithDraft({
      title: chatProposal.title,
      body: chatProposal.body,
      remindAt: chatProposal.remindAt,
      priority: chatProposal.priority,
      recurrence: chatProposal.recurrence,
      tags: chatProposal.tags,
    })
    showToast('Proposta pronta — revise e salve')
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-bg-elevated p-3.5">
        {chatMessages.length > 0 && (
          <div className="mb-3 flex max-h-[280px] flex-col gap-2 overflow-y-auto">
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-[13.5px] leading-relaxed ${
                  m.role === 'user'
                    ? 'self-end bg-accent text-text-on-accent'
                    : 'self-start border border-border bg-bg-base text-text-secondary'
                }`}
              >
                {m.text}
              </div>
            ))}
            {chatPending && (
              <div className="self-start inline-flex items-center gap-2 rounded-lg border border-border bg-bg-base px-3 py-2 text-[13px] text-text-muted">
                <Icon name="loader-2" size={14} className="animate-spin" /> pensando…
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendChat()
              }
            }}
            rows={2}
            placeholder={chatMessages.length === 0 ? 'Ex.: lembrar de ligar pro dentista' : 'Ajuste: "na verdade, terça 10h"'}
            className="min-h-[48px] w-full resize-y rounded-md border border-border bg-bg-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
          />
          <button
            onClick={sendChat}
            disabled={!chatInput.trim() || chatPending}
            aria-label="Enviar"
            className="grid h-[48px] w-[48px] flex-none place-items-center rounded-md bg-accent text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Icon name="send" size={18} />
          </button>
        </div>
        {chatMessages.length > 0 && (
          <button onClick={resetChat} className="mt-2 text-[12px] text-text-muted hover:text-text-primary">
            Recomeçar conversa
          </button>
        )}
      </div>

      {chatError && <ErrorBox message={chatError} />}

      {chatProposal?.title && (
        <div className="mt-4 rounded-lg border border-accent bg-accent-surface p-4">
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-accent-ink">Proposta</div>
          <div className="text-[15px] font-semibold text-text-primary">{chatProposal.title}</div>
          {chatProposal.body && <div className="mt-0.5 text-[13px] text-text-secondary">{chatProposal.body}</div>}
          <div className="mt-1 text-[12.5px] text-text-secondary">
            {fmt(chatProposal.remindAt)} · {PRIO_LABEL[chatProposal.priority] ?? chatProposal.priority}
            {chatProposal.recurrence !== 'once' && ' · recorrente'}
          </div>
          <button
            onClick={openInEditor}
            className="mt-3 inline-flex h-[40px] items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
          >
            <Icon name="pencil" size={15} /> Abrir no editor
          </button>
        </div>
      )}
    </>
  )
}

/** Modo "Editar": instrução → cartão com o que a IA entendeu → abre o item pra confirmar. */
function EditPanel() {
  const { data: reminders = [] } = useReminders()
  const items = useNoteItems()
  const openEditorForEdit = useAppStore((s) => s.openEditorForEdit)
  const showToast = useAppStore((s) => s.showToast)
  const { editInput, editResult, editPending, editError, setEditInput, runEdit } = useAssistantStore()

  const result = editResult
  const target = result?.targetId ? reminders.find((r) => r.id === result.targetId) : undefined
  const hasChange = !!result && Object.keys(result.patch).length > 0

  const open = () => {
    if (!result || !target) return
    openEditorForEdit(target, result.patch as Partial<Parameters<typeof openEditorForEdit>[1]>)
    showToast('Revise e salve')
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-bg-elevated p-3.5">
        <textarea
          value={editInput}
          onChange={(e) => setEditInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              runEdit(items)
            }
          }}
          rows={2}
          placeholder='Ex.: "adie a reunião pra sexta às 15h" ou "muda a conta de luz pra urgente"'
          className="min-h-[56px] w-full resize-y rounded-md border border-border bg-bg-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-text-muted">
            {items.length === 0 ? 'Nenhum item ativo' : `${items.length} ${items.length === 1 ? 'item' : 'itens'}`}
          </span>
          <button
            onClick={() => runEdit(items)}
            disabled={!editInput.trim() || items.length === 0 || editPending}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {editPending ? <Icon name="loader-2" size={16} className="animate-spin" /> : <Icon name="pencil" size={16} />}
            {editPending ? 'Interpretando…' : 'Interpretar'}
          </button>
        </div>
      </div>

      {editError && <ErrorBox message={editError} />}

      {result && !editPending && (
        <div className="mt-4 rounded-lg border border-border bg-bg-elevated p-4">
          <div className="mb-1 text-[12px] font-semibold uppercase tracking-[.04em] text-text-muted">Entendi</div>
          <div className="text-[13.5px] text-text-secondary">
            {result.note || (hasChange ? 'Mudança proposta.' : 'Sem mudança clara.')}
          </div>
          {hasChange && target ? (
            <button
              onClick={open}
              className="mt-3 inline-flex h-[40px] items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
            >
              <Icon name="pencil" size={15} /> Abrir no editor
            </button>
          ) : (
            <div className="mt-2 text-[12.5px] text-text-muted">
              {result.targetId && !target ? 'O item não está mais na lista.' : 'Não encontrei um item para alterar.'}
            </div>
          )}
        </div>
      )}
    </>
  )
}

/** Modo "Organizar": resumo + ações. Cada ação abre o item pra confirmar. */
function OrganizePanel() {
  const { data: reminders = [] } = useReminders()
  const items = useNoteItems()
  const openEditorForEdit = useAppStore((s) => s.openEditorForEdit)
  const showToast = useAppStore((s) => s.showToast)
  const { organizeFocus, organizeResult, organizePending, organizeError, setOrganizeFocus, runOrganize } =
    useAssistantStore()

  const applyAction = (targetId: string, patch: AiReminderPatch) => {
    const target = reminders.find((r) => r.id === targetId)
    if (!target) return showToast('Item não encontrado')
    openEditorForEdit(target, patch as Partial<Parameters<typeof openEditorForEdit>[1]>)
    showToast('Revise e salve')
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-bg-elevated p-3.5">
        <input
          value={organizeFocus}
          onChange={(e) => setOrganizeFocus(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              runOrganize(items)
            }
          }}
          placeholder="Foco (opcional) — ex.: priorizar o trabalho desta semana"
          className="h-11 w-full rounded-md border border-border bg-bg-base px-3.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-text-muted">
            {items.length === 0 ? 'Nenhum item ativo' : `${items.length} ${items.length === 1 ? 'item' : 'itens'} ativos`}
          </span>
          <button
            onClick={() => runOrganize(items)}
            disabled={items.length === 0 || organizePending}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {organizePending ? <Icon name="loader-2" size={16} className="animate-spin" /> : <Icon name="list-todo" size={16} />}
            {organizePending ? 'Organizando…' : 'Organizar'}
          </button>
        </div>
      </div>

      {organizeError && <ErrorBox message={organizeError} />}

      {organizeResult && (
        <div className="mt-4 flex flex-col gap-4">
          {organizeResult.summary && (
            <div className="rounded-lg border border-border bg-bg-elevated p-4">
              <div className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[.04em] text-text-muted">
                <Icon name="sparkles" size={12} /> Resumo
              </div>
              <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-secondary">
                {organizeResult.summary}
              </div>
            </div>
          )}

          {organizeResult.actions.length > 0 && (
            <div className="rounded-lg border border-border bg-bg-elevated p-4">
              <div className="mb-2.5 text-[12px] font-semibold uppercase tracking-[.04em] text-text-muted">
                Ações sugeridas
              </div>
              <div className="flex flex-col gap-2">
                {organizeResult.actions.map((a, i) => (
                  <div
                    key={`${a.targetId}-${i}`}
                    className="flex items-center gap-2.5 rounded-md border border-border bg-bg-base px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 text-[13px] text-text-secondary">{a.label}</span>
                    <button
                      onClick={() => applyAction(a.targetId, a.patch)}
                      className="inline-flex h-8 flex-none items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-3 text-[12.5px] font-semibold text-text-primary transition-colors hover:border-accent hover:text-accent-ink"
                    >
                      <Icon name="check" size={13} /> Aplicar
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[11.5px] text-text-muted">Cada ação abre o item para você confirmar e salvar.</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/** Modo "Buscar na web": pergunta → resposta com fontes (grounding). Roda em background pelo store. */
function SearchPanel() {
  const { searchInput, searchResult, searchPending, searchError, setSearchInput, runSearch } = useAssistantStore()

  return (
    <>
      <div className="rounded-lg border border-border bg-bg-elevated p-3.5">
        <textarea
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              runSearch()
            }
          }}
          rows={2}
          placeholder="Ex.: qual o feriado nacional mais próximo?"
          className="min-h-[56px] w-full resize-y rounded-md border border-border bg-bg-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="hidden text-[11.5px] text-text-muted sm:inline">Ctrl + Enter para buscar</span>
          <button
            onClick={runSearch}
            disabled={!searchInput.trim() || searchPending}
            className="inline-flex h-[42px] items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {searchPending ? <Icon name="loader-2" size={16} className="animate-spin" /> : <Icon name="search" size={16} />}
            {searchPending ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </div>

      {searchError && <ErrorBox message={searchError} />}

      {searchResult && (
        <div className="mt-4 rounded-lg border border-border bg-bg-elevated p-4">
          <div className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[.04em] text-text-muted">
            <Icon name="search" size={12} /> Resposta
          </div>
          <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-text-secondary">
            {searchResult.answer}
          </div>
          {searchResult.sources.length > 0 && (
            <div className="mt-3.5 border-t border-border pt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.04em] text-text-muted">Fontes</div>
              <div className="flex flex-col gap-1.5">
                {searchResult.sources.map((s, i) => (
                  <a
                    key={`${s.url}-${i}`}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-[12.5px] text-accent-ink transition-colors hover:text-accent"
                  >
                    <Icon name="chevron-right" size={13} className="flex-none" />
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
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

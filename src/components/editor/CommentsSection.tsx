import { useEffect, useRef, useState } from 'react'
import { useAddComment, useComments, useDeleteComment } from '@/hooks/useComments'
import { formatRemindAt } from '@/lib/reminders'
import { Icon } from '@/components/ui/Icon'

/**
 * Chat da nota (estilo TimeTree: cada lembrete/tarefa tem sua conversa). Meus balões à
 * direita em destaque; dos outros à esquerda. Comentários chegam ao vivo (realtime).
 * Usado no modal de visualização e nos editores.
 */
export function CommentsSection({ noteId }: { noteId: string }) {
  const { data: comments = [], isLoading } = useComments(noteId)
  const add = useAddComment()
  const del = useDeleteComment()
  const [text, setText] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)

  // Rola para a última mensagem quando a conversa muda.
  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [comments.length])

  const submit = async () => {
    const body = text.trim()
    if (!body) return
    setText('')
    try {
      await add.mutateAsync({ noteId, body })
    } catch {
      setText(body) // devolve o texto se falhar
    }
  }

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        <Icon name="message-circle" size={15} />
        Conversa {comments.length > 0 && <span className="text-text-muted">· {comments.length}</span>}
      </div>

      <div
        ref={feedRef}
        className="flex max-h-[300px] flex-col gap-2.5 overflow-y-auto rounded-md border border-border bg-bg-base p-3"
      >
        {comments.map((c) => (
          <div key={c.id} className={`flex max-w-[85%] gap-2 ${c.mine ? 'self-end flex-row-reverse' : 'self-start'}`}>
            {!c.mine && (
              <span
                className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-[10px] font-bold text-[#0A0A0B]"
                style={{ background: c.authorColor }}
              >
                {c.authorInitials}
              </span>
            )}
            <div
              className={`group rounded-xl border px-3 py-2 ${
                c.mine
                  ? 'rounded-br-sm border-accent/35 bg-accent-surface'
                  : 'rounded-bl-sm border-border bg-bg-elevated'
              }`}
            >
              <div className="mb-0.5 flex items-center gap-2">
                <span className={`text-[11.5px] font-semibold ${c.mine ? 'text-accent' : 'text-text-secondary'}`}>
                  {c.mine ? 'Você' : c.authorName.split(' ')[0]}
                </span>
                <span className="text-[10.5px] text-text-muted">{formatRemindAt(c.createdAt)}</span>
                {c.mine && (
                  <button
                    onClick={() => del.mutate({ id: c.id, noteId })}
                    aria-label="Apagar comentário"
                    title="Apagar"
                    className="grid h-4 w-4 place-items-center rounded text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    <Icon name="x" size={11} />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-[13.5px] leading-normal text-text-primary">
                {c.body}
              </p>
            </div>
          </div>
        ))}
        {!isLoading && comments.length === 0 && (
          <p className="py-4 text-center text-[13px] text-text-muted">
            Nenhuma mensagem ainda. Comece a conversa.
          </p>
        )}
      </div>

      <div className="mt-2.5 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder="Escreva uma mensagem…"
          className="h-[42px] min-w-0 flex-1 rounded-full border border-border bg-bg-base px-4 text-sm text-text-primary outline-none focus:border-border-strong"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || add.isPending}
          aria-label="Enviar"
          title="Enviar"
          className="grid h-[42px] w-[42px] flex-none place-items-center rounded-full bg-accent text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {add.isPending ? (
            <Icon name="loader-2" size={16} className="animate-spin" />
          ) : (
            <Icon name="send" size={16} />
          )}
        </button>
      </div>
    </div>
  )
}

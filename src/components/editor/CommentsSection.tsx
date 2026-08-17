import { useState } from 'react'
import { useAddComment, useComments, useDeleteComment } from '@/hooks/useComments'
import { formatRemindAt } from '@/lib/reminders'
import { Icon } from '@/components/ui/Icon'

/** Comentários de um lembrete (mostrado no editor, em modo edição). Colaboração — Fase 4. */
export function CommentsSection({ noteId }: { noteId: string }) {
  const { data: comments = [], isLoading } = useComments(noteId)
  const add = useAddComment()
  const del = useDeleteComment()
  const [text, setText] = useState('')

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
        Comentários {comments.length > 0 && <span className="text-text-muted">· {comments.length}</span>}
      </div>

      <div className="flex flex-col gap-3">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <span
              className="grid h-7 w-7 flex-none place-items-center rounded-full text-[11px] font-bold text-[#0A0A0B]"
              style={{ background: c.authorColor }}
            >
              {c.authorInitials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold">{c.authorName}</span>
                <span className="flex-none text-[11.5px] text-text-muted">{formatRemindAt(c.createdAt)}</span>
                {c.mine && (
                  <button
                    onClick={() => del.mutate({ id: c.id, noteId })}
                    aria-label="Apagar comentário"
                    title="Apagar"
                    className="ml-auto grid h-6 w-6 flex-none place-items-center rounded text-text-muted transition-colors hover:bg-bg-elevated-2 hover:text-danger"
                  >
                    <Icon name="x" size={13} />
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
          <p className="text-[13px] text-text-muted">Nenhum comentário ainda. Comece a conversa.</p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void submit()
            }
          }}
          placeholder="Escreva um comentário… (Ctrl+Enter envia)"
          className="min-h-[40px] w-full flex-1 resize-y rounded-md border border-border bg-bg-base px-3 py-2 text-sm text-text-primary outline-none focus:border-border-strong"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || add.isPending}
          className="inline-flex h-10 flex-none items-center gap-1.5 self-start rounded-md bg-accent px-3.5 text-[13px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {add.isPending ? <Icon name="loader-2" size={15} className="animate-spin" /> : <Icon name="message-circle" size={15} />}
          Comentar
        </button>
      </div>
    </div>
  )
}

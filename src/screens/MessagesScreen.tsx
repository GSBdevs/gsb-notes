import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { DmConversation, DmMessage, DmNoteRef, NoteKind, Person, Reminder } from '@/types'
import {
  useConversations,
  useMarkDmRead,
  useMessages,
  useSendMessage,
  useStartConversation,
} from '@/hooks/useDm'
import { usePeople } from '@/hooks/usePeople'
import { useReminders } from '@/hooks/useReminders'
import { useAppStore } from '@/store/useAppStore'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Avatar } from '@/components/ui/primitives'

/** Ícone + rótulo por tipo de nota (para os cards nas mensagens). */
const KIND_META: Record<NoteKind, { icon: string; label: string }> = {
  reminder: { icon: 'bell', label: 'Lembrete' },
  doc: { icon: 'list-todo', label: 'Tarefa' },
  block: { icon: 'blocks', label: 'Bloco' },
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function fmtInbox(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return fmtTime(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function MessagesScreen() {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('c')
  const { data: conversations = [], isLoading } = useConversations()
  const [pickPeople, setPickPeople] = useState(false)
  const selected = conversations.find((c) => c.id === selectedId) ?? null

  const select = (id: string | null) =>
    setParams(id ? { c: id } : {}, { replace: false })

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] overflow-hidden rounded-lg border border-border bg-bg-elevated md:h-[calc(100dvh-9.5rem)]">
      {/* Lista de conversas (esconde no mobile quando há uma aberta) */}
      <aside
        className={`w-full flex-none flex-col border-r border-border md:w-[330px] md:flex ${
          selectedId ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h2 className="flex-1 text-sm font-semibold">Conversas</h2>
          <button
            onClick={() => setPickPeople(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-[13px] font-semibold text-text-on-accent transition-colors hover:bg-accent-hover"
          >
            <Icon name="plus" size={14} /> Nova
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-text-muted">Carregando…</p>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted">
              Nenhuma conversa ainda. Toque em <span className="font-semibold">Nova</span> para
              começar com alguém das suas Pessoas.
            </p>
          ) : (
            conversations.map((c) => (
              <ConversationRow key={c.id} c={c} active={c.id === selectedId} onClick={() => select(c.id)} />
            ))
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={`min-w-0 flex-1 flex-col ${selectedId ? 'flex' : 'hidden md:flex'}`}>
        {selected ? (
          <Thread conversation={selected} onBack={() => select(null)} />
        ) : selectedId && isLoading ? (
          <div className="grid flex-1 place-items-center text-sm text-text-muted">Carregando…</div>
        ) : (
          <div className="grid flex-1 place-items-center px-6 text-center text-sm text-text-muted">
            <div>
              <Icon name="message-circle" size={28} className="mx-auto mb-2 opacity-60" />
              Escolha uma conversa ou comece uma nova.
            </div>
          </div>
        )}
      </section>

      {pickPeople && <PeoplePicker onClose={() => setPickPeople(false)} />}
    </div>
  )
}

function ConversationRow({ c, active, onClick }: { c: DmConversation; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-bg-elevated-2 ${
        active ? 'bg-bg-elevated-2' : ''
      }`}
    >
      <Avatar initials={c.peerInitials} color={c.peerColor} src={c.peerAvatar} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{c.peerName}</span>
          <span className="ml-auto flex-none text-[11px] text-text-muted">{fmtInbox(c.lastMessageAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="truncate text-[12.5px] text-text-muted">{c.lastPreview || '—'}</span>
          {c.unread > 0 && (
            <span className="ml-auto grid h-5 min-w-5 flex-none place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-text-on-accent">
              {c.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function Thread({ conversation, onBack }: { conversation: DmConversation; onBack: () => void }) {
  const { data: messages = [] } = useMessages(conversation.id)
  const send = useSendMessage()
  const markRead = useMarkDmRead()
  const endRef = useRef<HTMLDivElement>(null)

  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<DmMessage | null>(null)
  const [noteRef, setNoteRef] = useState<DmNoteRef | null>(null)
  const [pickNote, setPickNote] = useState(false)

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const lastId = messages[messages.length - 1]?.id

  // Rola para o fim quando chega mensagem nova.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lastId])

  // Marca como lida ao abrir e quando chega mensagem nova.
  useEffect(() => {
    if (messages.length) markRead.mutate(conversation.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id, lastId])

  const onSend = () => {
    const body = text.trim()
    if (!body && !noteRef) return
    send.mutate({
      conversationId: conversation.id,
      body,
      replyToId: replyTo?.id ?? null,
      noteRef: noteRef ? { id: noteRef.noteId as string, kind: noteRef.kind, title: noteRef.title } : null,
    })
    setText('')
    setReplyTo(null)
    setNoteRef(null)
  }

  return (
    <>
      {/* Cabeçalho da conversa */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5 md:px-4">
        <button
          onClick={onBack}
          aria-label="Voltar"
          className="grid h-9 w-9 flex-none place-items-center rounded-md text-text-secondary transition-colors hover:bg-bg-elevated md:hidden"
        >
          <Icon name="arrow-left" size={20} />
        </button>
        <Avatar initials={conversation.peerInitials} color={conversation.peerColor} src={conversation.peerAvatar} size={34} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{conversation.peerName}</div>
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-3 py-4 md:px-5">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-text-muted">
            Nenhuma mensagem ainda. Diga um oi.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                m={m}
                repliedTo={m.replyToId ? byId.get(m.replyToId) ?? null : null}
                onReply={() => setReplyTo(m)}
              />
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex-none border-t border-border p-2.5 md:p-3">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-md border-l-2 border-accent bg-bg-base px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-accent-ink">
                Respondendo {replyTo.mine ? 'você' : conversation.peerName}
              </div>
              <div className="truncate text-[12px] text-text-muted">
                {replyTo.body || (replyTo.noteRef ? KIND_META[replyTo.noteRef.kind].label : '')}
              </div>
            </div>
            <button onClick={() => setReplyTo(null)} aria-label="Cancelar resposta" className="text-text-muted hover:text-text-primary">
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
        {noteRef && (
          <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-bg-base px-2.5 py-1.5">
            <Icon name={KIND_META[noteRef.kind].icon} size={15} style={{ color: 'var(--accent-ink)' }} />
            <span className="truncate text-[12.5px]">{noteRef.title || KIND_META[noteRef.kind].label}</span>
            <button onClick={() => setNoteRef(null)} aria-label="Remover nota" className="ml-auto text-text-muted hover:text-text-primary">
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => setPickNote(true)}
            aria-label="Anexar nota"
            title="Enviar um lembrete, tarefa ou bloco"
            className="grid h-10 w-10 flex-none place-items-center rounded-md border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Icon name="paperclip" size={18} />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            rows={1}
            placeholder="Escreva uma mensagem…"
            className="max-h-32 min-h-10 flex-1 resize-none rounded-md border border-border bg-bg-base px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent"
          />
          <button
            onClick={onSend}
            disabled={!text.trim() && !noteRef}
            aria-label="Enviar"
            className="grid h-10 w-10 flex-none place-items-center rounded-md bg-accent text-text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>

      {pickNote && (
        <NotePicker
          onClose={() => setPickNote(false)}
          onPick={(ref) => {
            setNoteRef(ref)
            setPickNote(false)
          }}
        />
      )}
    </>
  )
}

function MessageBubble({
  m,
  repliedTo,
  onReply,
}: {
  m: DmMessage
  repliedTo: DmMessage | null
  onReply: () => void
}) {
  const mine = m.mine
  return (
    <div className={`group flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
      <div
        className={`relative max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
          mine
            ? 'rounded-br-sm bg-accent-surface text-text-primary'
            : 'rounded-bl-sm bg-bg-elevated-2 text-text-primary'
        }`}
      >
        {/* Citação (resposta) */}
        {m.replyToId && (
          <div className="mb-1 rounded-md border-l-2 border-accent bg-bg-base/60 px-2 py-1">
            <div className="truncate text-[11.5px] text-text-muted">
              {repliedTo
                ? repliedTo.body || (repliedTo.noteRef ? KIND_META[repliedTo.noteRef.kind].label : 'Nota')
                : 'Mensagem'}
            </div>
          </div>
        )}
        {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
        {m.noteRef && <DmNoteCard noteRef={m.noteRef} />}
        <div className={`mt-0.5 text-right text-[10.5px] text-text-muted ${m.system ? 'italic' : ''}`}>
          {m.system ? 'automático · ' : ''}
          {fmtTime(m.createdAt)}
        </div>
      </div>
      <button
        onClick={onReply}
        aria-label="Responder"
        title="Responder"
        className="mb-1 grid h-7 w-7 flex-none place-items-center rounded-full text-text-muted opacity-0 transition-opacity hover:bg-bg-elevated hover:text-text-primary focus:opacity-100 group-hover:opacity-100"
      >
        <Icon name="reply" size={15} />
      </button>
    </div>
  )
}

/** Card compacto de uma nota citada/enviada (abre a nota se você tiver acesso). */
function DmNoteCard({ noteRef }: { noteRef: DmNoteRef }) {
  const { data: reminders = [] } = useReminders()
  const openView = useAppStore((s) => s.openView)
  const openTask = useAppStore((s) => s.openTask)
  const openBlock = useAppStore((s) => s.openBlock)
  const showToast = useAppStore((s) => s.showToast)
  const meta = KIND_META[noteRef.kind] ?? KIND_META.reminder

  const open = () => {
    if (!noteRef.noteId) {
      showToast('Essa nota não está mais disponível.')
      return
    }
    const note = reminders.find((r: Reminder) => r.id === noteRef.noteId)
    if (!note) {
      showToast('Você não tem acesso a essa nota.')
      return
    }
    if (note.kind === 'block') openBlock(note.id)
    else if (note.kind === 'doc') openTask(note)
    else openView(note.id)
  }

  return (
    <button
      onClick={open}
      className="mt-1.5 flex w-full items-center gap-2.5 rounded-lg border border-border bg-bg-base px-3 py-2 text-left transition-colors hover:border-border-strong"
    >
      <span className="grid h-8 w-8 flex-none place-items-center rounded-md bg-accent-surface text-accent-ink">
        <Icon name={meta.icon} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{meta.label}</div>
        <div className="truncate text-[13px] font-medium">{noteRef.title || '(sem título)'}</div>
      </div>
      <Icon name="chevron-right" size={16} className="flex-none text-text-muted" />
    </button>
  )
}

/** Seletor de pessoa para iniciar uma conversa (contatos + gente com quem você compartilha). */
function PeoplePicker({ onClose }: { onClose: () => void }) {
  const { data: people = [] } = usePeople()
  const start = useStartConversation()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const list = people.filter((p: Person) => p.name.toLowerCase().includes(q.trim().toLowerCase()))

  const onPick = async (p: Person) => {
    if (busy) return
    setBusy(true)
    try {
      const id = await start.mutateAsync(p.userId)
      await qc.refetchQueries({ queryKey: ['dm-conversations'] })
      navigate(`/mensagens?c=${id}`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Nova conversa" onClose={onClose}>
      <div className="p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar pessoa…"
          className="mb-3 h-10 w-full rounded-md border border-border bg-bg-base px-3 text-sm outline-none focus:border-accent"
        />
        {list.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-muted">
            Ninguém aqui ainda. Adicione pessoas na aba <span className="font-semibold">Pessoas</span>.
          </p>
        ) : (
          <div className="flex max-h-[50vh] flex-col overflow-y-auto">
            {list.map((p) => (
              <button
                key={p.userId}
                onClick={() => onPick(p)}
                disabled={busy}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-bg-elevated disabled:opacity-60"
              >
                <Avatar initials={p.initials} color={p.color} src={p.avatarUrl} size={36} />
                <span className="truncate text-sm font-medium">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Seletor de nota (lembrete/tarefa/bloco) para enviar numa mensagem. */
function NotePicker({ onClose, onPick }: { onClose: () => void; onPick: (ref: DmNoteRef) => void }) {
  const { data: reminders = [] } = useReminders()
  const [q, setQ] = useState('')
  const list = reminders
    .filter((r: Reminder) => r.status !== 'archived')
    .filter((r: Reminder) => r.title.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 60)

  return (
    <Modal title="Enviar uma nota" onClose={onClose} maxWidth={520}>
      <div className="p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar lembrete, tarefa ou bloco…"
          className="mb-3 h-10 w-full rounded-md border border-border bg-bg-base px-3 text-sm outline-none focus:border-accent"
        />
        {list.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-muted">Nada encontrado.</p>
        ) : (
          <div className="flex max-h-[55vh] flex-col overflow-y-auto">
            {list.map((r) => {
              const meta = KIND_META[r.kind] ?? KIND_META.reminder
              return (
                <button
                  key={r.id}
                  onClick={() => onPick({ noteId: r.id, kind: r.kind, title: r.title })}
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-bg-elevated"
                >
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-md bg-accent-surface text-accent-ink">
                    <Icon name={meta.icon} size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{meta.label}</div>
                    <div className="truncate text-sm font-medium">{r.title || '(sem título)'}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

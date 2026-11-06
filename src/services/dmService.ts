import type { DmConversation, DmMessage, NoteKind } from '@/types'
import { initialsFromName } from '@/lib/constants'
import { hasSupabase, supabase } from './supabase'

/**
 * Mensagens diretas (DM) 1:1. A UI nunca fala com o Supabase direto — passa por aqui (mock ↔ Supabase,
 * mesma interface). Ver migração 0023. Sem apagar mensagem e sem anexo (por ora).
 */
export interface DmService {
  /** Inbox: minhas conversas, mais recente primeiro (com prévia + não-lidas). */
  listConversations(): Promise<DmConversation[]>
  /** Abre/começa a conversa com alguém; devolve o id da conversa. */
  getOrCreateConversation(peerId: string): Promise<string>
  /** Mensagens de uma conversa, em ordem cronológica. */
  listMessages(conversationId: string): Promise<DmMessage[]>
  /** Envia uma mensagem (texto, resposta e/ou card de nota). */
  sendMessage(input: {
    conversationId: string
    body: string
    replyToId?: string | null
    noteRef?: { id: string; kind: NoteKind; title: string } | null
  }): Promise<void>
  /** Envia uma figurinha (caminho no bucket 'stickers'). */
  sendSticker(conversationId: string, stickerPath: string): Promise<void>
  /** Marca a conversa como lida até agora (zera o contador de não-lidas). */
  markRead(conversationId: string): Promise<void>
}

interface InboxRow {
  conversation_id: string
  peer_id: string
  peer_name: string | null
  peer_color: string | null
  peer_avatar: string | null
  last_message_at: string
  last_body: string | null
  last_system: boolean | null
  last_ref_kind: string | null
  unread: number
}

interface MessageRow {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  reply_to: string | null
  ref_note_id: string | null
  ref_kind: string | null
  ref_title: string | null
  system: boolean
  sticker_path: string | null
  created_at: string
}

const MSG_COLS =
  'id, conversation_id, sender_id, body, reply_to, ref_note_id, ref_kind, ref_title, system, sticker_path, created_at'

class SupabaseDmService implements DmService {
  private sb() {
    if (!supabase) throw new Error('Supabase não configurado.')
    return supabase
  }
  private async uid(): Promise<string | null> {
    const { data } = await this.sb().auth.getUser()
    return data.user?.id ?? null
  }

  async listConversations(): Promise<DmConversation[]> {
    const { data, error } = await this.sb().rpc('dm_inbox')
    if (error) throw error
    return ((data ?? []) as InboxRow[]).map((r) => {
      const name = r.peer_name ?? 'Usuário'
      const body = (r.last_body ?? '').trim()
      const preview = body || (r.last_ref_kind ? 'Nota compartilhada' : '')
      return {
        id: r.conversation_id,
        peerId: r.peer_id,
        peerName: name,
        peerInitials: initialsFromName(name),
        peerColor: r.peer_color ?? '#94A3B8',
        peerAvatar: r.peer_avatar,
        lastMessageAt: r.last_message_at,
        lastPreview: preview,
        unread: Number(r.unread) || 0,
      }
    })
  }

  async getOrCreateConversation(peerId: string): Promise<string> {
    const { data, error } = await this.sb().rpc('dm_get_or_create_conversation', { peer: peerId })
    if (error) throw error
    return data as string
  }

  async listMessages(conversationId: string): Promise<DmMessage[]> {
    const me = await this.uid()
    const { data, error } = await this.sb()
      .from('dm_messages')
      .select(MSG_COLS)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return ((data ?? []) as MessageRow[]).map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      mine: m.sender_id === me,
      body: m.body,
      system: m.system,
      replyToId: m.reply_to,
      noteRef:
        m.ref_note_id || m.ref_kind
          ? { noteId: m.ref_note_id, kind: (m.ref_kind ?? 'reminder') as NoteKind, title: m.ref_title ?? '' }
          : null,
      stickerUrl: m.sticker_path
        ? this.sb().storage.from('stickers').getPublicUrl(m.sticker_path).data.publicUrl
        : null,
      createdAt: m.created_at,
    }))
  }

  async sendMessage(input: {
    conversationId: string
    body: string
    replyToId?: string | null
    noteRef?: { id: string; kind: NoteKind; title: string } | null
  }): Promise<void> {
    const me = await this.uid()
    if (!me) throw new Error('Sem sessão.')
    const { error } = await this.sb().from('dm_messages').insert({
      conversation_id: input.conversationId,
      sender_id: me,
      body: input.body,
      reply_to: input.replyToId ?? null,
      ref_note_id: input.noteRef?.id ?? null,
      ref_kind: input.noteRef?.kind ?? null,
      ref_title: input.noteRef?.title ?? null,
    })
    if (error) throw error
  }

  async sendSticker(conversationId: string, stickerPath: string): Promise<void> {
    const me = await this.uid()
    if (!me) throw new Error('Sem sessão.')
    const { error } = await this.sb().from('dm_messages').insert({
      conversation_id: conversationId,
      sender_id: me,
      body: '',
      sticker_path: stickerPath,
    })
    if (error) throw error
  }

  async markRead(conversationId: string): Promise<void> {
    const me = await this.uid()
    if (!me) return
    const { error } = await this.sb()
      .from('dm_reads')
      .upsert(
        { conversation_id: conversationId, user_id: me, last_read_at: new Date().toISOString() },
        { onConflict: 'conversation_id,user_id' },
      )
    if (error) throw error
  }
}

/** Mock (single-user): sem ninguém para conversar, o inbox fica vazio. */
class MockDmService implements DmService {
  async listConversations(): Promise<DmConversation[]> {
    return []
  }
  async getOrCreateConversation(): Promise<string> {
    return ''
  }
  async listMessages(): Promise<DmMessage[]> {
    return []
  }
  async sendMessage(): Promise<void> {}
  async sendSticker(): Promise<void> {}
  async markRead(): Promise<void> {}
}

export const dmService: DmService = hasSupabase ? new SupabaseDmService() : new MockDmService()

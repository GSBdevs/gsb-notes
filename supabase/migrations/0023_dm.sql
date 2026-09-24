-- Mensagens diretas (DM) 1:1 entre usuários. Responder mensagem (reply_to), SEM apagar e SEM anexos
-- (por ora). Integra com o SB Notas: uma mensagem pode referenciar uma nota (lembrete/tarefa/bloco)
-- e, ao compartilhar uma nota, um trigger envia automaticamente uma mensagem do dono para a pessoa
-- adicionada ("Você foi adicionado em: '<título>'") com o card. Rode no SQL Editor DEPOIS de 0001→0022.

-- ── Conversas (par canônico user_a < user_b) ──────────────────────────────────────────────────
create table if not exists public.dm_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references public.profiles(id) on delete cascade,
  user_b          uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists dm_conversations_a_idx on public.dm_conversations (user_a);
create index if not exists dm_conversations_b_idx on public.dm_conversations (user_b);

-- ── Mensagens ─────────────────────────────────────────────────────────────────────────────────
create table if not exists public.dm_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null default '',
  reply_to        uuid references public.dm_messages(id) on delete set null,  -- responder (WhatsApp)
  ref_note_id     uuid references public.notes(id) on delete set null,        -- nota citada/enviada
  ref_kind        text,   -- 'reminder' | 'doc' | 'block' (snapshot p/ exibir mesmo sem acesso/apagada)
  ref_title       text,   -- título da nota no momento do envio (snapshot)
  system          boolean not null default false,  -- msg automática (ex.: "você foi adicionado em…")
  created_at      timestamptz not null default now()
);
create index if not exists dm_messages_conv_idx on public.dm_messages (conversation_id, created_at);

-- ── Estado de leitura (para o contador de não-lidas) ──────────────────────────────────────────
create table if not exists public.dm_reads (
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ── Helpers ───────────────────────────────────────────────────────────────────────────────────
-- Sou participante desta conversa? (SECURITY DEFINER evita recursão de RLS)
create or replace function public.dm_is_participant(cid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.dm_conversations c
    where c.id = cid and (c.user_a = auth.uid() or c.user_b = auth.uid())
  );
$$;

-- Conversa do par (cria se não existir). Interno — usa a ordem canônica.
create or replace function public.dm_conversation_for(u1 uuid, u2 uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare lo uuid := least(u1, u2); hi uuid := greatest(u1, u2); cid uuid;
begin
  if u1 is null or u2 is null or u1 = u2 then return null; end if;
  insert into public.dm_conversations (user_a, user_b) values (lo, hi)
    on conflict (user_a, user_b) do nothing;
  select id into cid from public.dm_conversations where user_a = lo and user_b = hi;
  return cid;
end;
$$;

-- RPC chamada pelo cliente para abrir/começar uma conversa com alguém.
create or replace function public.dm_get_or_create_conversation(peer uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if peer is null or peer = auth.uid() then raise exception 'peer inválido'; end if;
  return public.dm_conversation_for(auth.uid(), peer);
end;
$$;

-- Inbox: minhas conversas com a outra pessoa, prévia da última mensagem e nº de não-lidas — numa só
-- chamada (sem N+1). Ordena pela mais recente.
create or replace function public.dm_inbox()
returns table (
  conversation_id uuid, peer_id uuid, peer_name text, peer_color text, peer_avatar text,
  last_message_at timestamptz, last_body text, last_system boolean, last_ref_kind text, unread bigint
) language sql security definer stable set search_path = public as $$
  select
    c.id,
    case when c.user_a = auth.uid() then c.user_b else c.user_a end,
    p.display_name, p.avatar_color, p.avatar_url,
    c.last_message_at, lm.body, lm.system, lm.ref_kind,
    coalesce((
      select count(*) from public.dm_messages m
      where m.conversation_id = c.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    ), 0)
  from public.dm_conversations c
  join public.profiles p
    on p.id = (case when c.user_a = auth.uid() then c.user_b else c.user_a end)
  left join public.dm_reads r on r.conversation_id = c.id and r.user_id = auth.uid()
  left join lateral (
    select body, system, ref_kind from public.dm_messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where c.user_a = auth.uid() or c.user_b = auth.uid()
  order by c.last_message_at desc;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────────────────────
alter table public.dm_conversations enable row level security;
alter table public.dm_messages      enable row level security;
alter table public.dm_reads         enable row level security;

-- Conversas: leio as minhas. (Criação é só via RPC security-definer — sem policy de insert direto.)
drop policy if exists dm_conversations_select on public.dm_conversations;
create policy dm_conversations_select on public.dm_conversations
  for select to authenticated using (user_a = auth.uid() or user_b = auth.uid());

-- Mensagens: leio as das minhas conversas; envio como eu mesmo. SEM update/delete (não se apaga).
drop policy if exists dm_messages_select on public.dm_messages;
create policy dm_messages_select on public.dm_messages
  for select to authenticated using (public.dm_is_participant(conversation_id));

drop policy if exists dm_messages_insert on public.dm_messages;
create policy dm_messages_insert on public.dm_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.dm_is_participant(conversation_id));

-- Leitura: cada um gerencia a própria marca de "li até aqui".
drop policy if exists dm_reads_all on public.dm_reads;
create policy dm_reads_all on public.dm_reads
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── Triggers ──────────────────────────────────────────────────────────────────────────────────
-- Ao inserir mensagem, "levanta" a conversa (ordena o inbox pela mais recente).
create or replace function public.dm_touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.dm_conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists dm_messages_touch on public.dm_messages;
create trigger dm_messages_touch after insert on public.dm_messages
  for each row execute function public.dm_touch_conversation();

-- Ao compartilhar uma nota, manda a mensagem automática do DONO para a pessoa adicionada, com o card.
create or replace function public.dm_notify_share()
returns trigger language plpgsql security definer set search_path = public as $$
declare n record; cid uuid;
begin
  select owner_id, title, kind into n from public.notes where id = new.note_id;
  if n.owner_id is null or n.owner_id = new.shared_with then return new; end if;
  cid := public.dm_conversation_for(n.owner_id, new.shared_with);
  insert into public.dm_messages (conversation_id, sender_id, body, system, ref_note_id, ref_kind, ref_title)
  values (cid, n.owner_id,
          'Você foi adicionado em: ' || coalesce(nullif(n.title, ''), '(sem título)'),
          true, new.note_id, n.kind, n.title);
  return new;
end;
$$;
drop trigger if exists note_shares_dm_notify on public.note_shares;
create trigger note_shares_dm_notify after insert on public.note_shares
  for each row execute function public.dm_notify_share();

-- ── Realtime ──────────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.dm_messages;
alter publication supabase_realtime add table public.dm_conversations;

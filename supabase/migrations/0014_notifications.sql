-- Notificações (Fase 5). Cada usuário tem uma caixa de notificações (sino na topbar). As
-- notificações são geradas SOMENTE por triggers SECURITY DEFINER no banco — nunca pelo cliente
-- direto (ninguém injeta notificação em terceiros). O destinatário lê e marca como lida.
-- Eventos cobertos aqui (nota): compartilhada comigo, criada em quadro, editada, tarefa concluída.
-- Convites de contato ficam na 0015; itens de checklist na 0016 (dependem daquelas tabelas).
-- Rode no SQL Editor DEPOIS de 0001→0013.

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,  -- destinatário
  actor_id   uuid references public.profiles(id) on delete set null,          -- quem causou
  type       text not null,   -- note_shared | note_created | note_edited | task_completed
                              -- | checklist_item_done | contact_invite | contact_accepted
  note_id    uuid references public.notes(id) on delete cascade,
  title      text not null default '',   -- título da nota no momento (sobrevive a exclusões)
  body       text not null default '',   -- mensagem já pronta (ex.: "editou o lembrete")
  data       jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Só o destinatário lê / marca lida / apaga. NÃO há policy de INSERT: apenas os triggers
-- SECURITY DEFINER (rodando como owner) inserem — o cliente jamais cria notificação.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: cria uma notificação (nunca para si mesmo). Usado por todos os triggers
-- (aqui e nas migrações 0015/0016). SECURITY DEFINER: ignora RLS ao inserir.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.push_notification(
  p_user uuid, p_actor uuid, p_type text, p_note uuid,
  p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user = p_actor then
    return; -- nunca notifica o próprio autor da ação
  end if;
  insert into public.notifications (user_id, actor_id, type, note_id, title, body, data)
  values (p_user, p_actor, p_type, p_note, coalesce(p_title, ''), coalesce(p_body, ''), coalesce(p_data, '{}'::jsonb));
end;
$$;

-- Mensagem "editou/criou/concluiu o lembrete|a tarefa" conforme o kind.
create or replace function public.note_kind_noun(p_kind text)
returns text language sql immutable as $$
  select case when p_kind = 'doc' then 'a tarefa' else 'o lembrete' end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Nota compartilhada comigo (cobre "lembrete criado e compartilhado"): dispara quando
-- um note_shares é inserido. O ator é o dono (só ele insere shares, por RLS).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_note_shared()
returns trigger language plpgsql security definer set search_path = public as $$
declare n record;
begin
  select title, kind into n from public.notes where id = new.note_id;
  perform public.push_notification(
    new.shared_with, auth.uid(), 'note_shared', new.note_id,
    coalesce(n.title, ''), 'compartilhou ' || public.note_kind_noun(n.kind) || ' com você',
    jsonb_build_object('kind', n.kind, 'perm', new.permission)
  );
  return new;
end;
$$;

drop trigger if exists note_shares_notify on public.note_shares;
create trigger note_shares_notify
  after insert on public.note_shares
  for each row execute function public.notify_note_shared();

-- ─────────────────────────────────────────────────────────────────────────────
-- Nota criada num quadro → avisa os membros do quadro (o caso 1:1 já é coberto por
-- note_shares acima). Só para notas que já nascem num workspace.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_note_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  if new.workspace_id is null then
    return new;
  end if;
  for rec in
    select user_id as uid from public.workspace_members
    where workspace_id = new.workspace_id and user_id <> auth.uid()
  loop
    perform public.push_notification(
      rec.uid, auth.uid(), 'note_created', new.id,
      new.title, 'criou ' || public.note_kind_noun(new.kind) || ' no quadro', '{}'::jsonb
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notes_notify_created on public.notes;
create trigger notes_notify_created
  after insert on public.notes
  for each row execute function public.notify_note_created();

-- ─────────────────────────────────────────────────────────────────────────────
-- Nota editada → avisa todos os participantes (dono, shares 1:1 e membros do quadro),
-- menos quem editou. Só conteúdo (título/corpo/cor/prioridade/recorrência/tags); ignora
-- pin, status e reagendamento (snooze), para não gerar ruído.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_note_edited()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  if (new.title, new.body, new.color, new.priority, new.recurrence)
       is not distinct from (old.title, old.body, old.color, old.priority, old.recurrence)
     and new.tags is not distinct from old.tags then
    return new; -- nada de conteúdo mudou
  end if;
  for rec in
    select uid from (
      select shared_with as uid from public.note_shares where note_id = new.id
      union
      select user_id from public.workspace_members
        where new.workspace_id is not null and workspace_id = new.workspace_id
      union
      select new.owner_id
    ) t
    where uid is distinct from auth.uid()
  loop
    perform public.push_notification(
      rec.uid, auth.uid(), 'note_edited', new.id,
      new.title, 'editou ' || public.note_kind_noun(new.kind), '{}'::jsonb
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notes_notify_edited on public.notes;
create trigger notes_notify_edited
  after update on public.notes
  for each row execute function public.notify_note_edited();

-- ─────────────────────────────────────────────────────────────────────────────
-- Tarefa concluída (kind 'doc', status active → archived) → avisa os participantes.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_task_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  if new.kind <> 'doc' or new.status <> 'archived' or old.status = 'archived' then
    return new;
  end if;
  for rec in
    select uid from (
      select shared_with as uid from public.note_shares where note_id = new.id
      union
      select user_id from public.workspace_members
        where new.workspace_id is not null and workspace_id = new.workspace_id
      union
      select new.owner_id
    ) t
    where uid is distinct from auth.uid()
  loop
    perform public.push_notification(
      rec.uid, auth.uid(), 'task_completed', new.id,
      new.title, 'concluiu a tarefa', '{}'::jsonb
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists notes_notify_completed on public.notes;
create trigger notes_notify_completed
  after update of status on public.notes
  for each row execute function public.notify_task_completed();

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: o sino atualiza sozinho quando chega notificação.
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.notifications;

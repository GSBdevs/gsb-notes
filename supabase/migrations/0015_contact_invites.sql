-- Convites de contato (Fase 5). Antes, "adicionar pessoa" inseria um contato unilateral e sem
-- consentimento. Agora é um CONVITE: um envia, o outro confere e aceita — e aí os DOIS passam a
-- ter o outro na lista de contatos (bidirecional). O aceite cria as duas linhas de `contacts` via
-- trigger SECURITY DEFINER (a RLS de contacts só deixa cada um gerenciar a própria linha).
-- Depende de push_notification (0014). Rode no SQL Editor DEPOIS de 0014.

create table if not exists public.contact_invites (
  id           uuid primary key default gen_random_uuid(),
  from_user    uuid not null references public.profiles(id) on delete cascade,
  to_user      uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (from_user, to_user),
  check (from_user <> to_user)
);

create index if not exists contact_invites_to_idx   on public.contact_invites (to_user, status);
create index if not exists contact_invites_from_idx on public.contact_invites (from_user, status);

alter table public.contact_invites enable row level security;

-- Ver: quem enviou ou quem recebeu.
drop policy if exists contact_invites_select on public.contact_invites;
create policy contact_invites_select on public.contact_invites
  for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());

-- Enviar: só como remetente (e nunca para si mesmo, garantido pelo CHECK da tabela).
drop policy if exists contact_invites_insert on public.contact_invites;
create policy contact_invites_insert on public.contact_invites
  for insert to authenticated with check (from_user = auth.uid());

-- Responder (aceitar/recusar): só o destinatário.
drop policy if exists contact_invites_update on public.contact_invites;
create policy contact_invites_update on public.contact_invites
  for update to authenticated using (to_user = auth.uid()) with check (to_user = auth.uid());

-- Cancelar: só o remetente.
drop policy if exists contact_invites_delete on public.contact_invites;
create policy contact_invites_delete on public.contact_invites
  for delete to authenticated using (from_user = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifica o destinatário ao receber um convite.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_contact_invite()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.push_notification(
    new.to_user, new.from_user, 'contact_invite', null,
    '', 'quer te adicionar como contato', jsonb_build_object('invite_id', new.id)
  );
  return new;
end;
$$;

drop trigger if exists contact_invites_notify on public.contact_invites;
create trigger contact_invites_notify
  after insert on public.contact_invites
  for each row execute function public.notify_contact_invite();

-- ─────────────────────────────────────────────────────────────────────────────
-- Carimba responded_at quando o convite deixa de estar pendente.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.stamp_contact_invite_response()
returns trigger language plpgsql as $$
begin
  if new.status <> 'pending' and old.status = 'pending' then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists contact_invites_stamp on public.contact_invites;
create trigger contact_invites_stamp
  before update on public.contact_invites
  for each row execute function public.stamp_contact_invite_response();

-- ─────────────────────────────────────────────────────────────────────────────
-- Ao ACEITAR: cria as duas linhas de contato (bidirecional) e avisa o remetente.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.on_contact_invite_accepted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.contacts (owner_id, contact_id)
      values (new.from_user, new.to_user) on conflict do nothing;
    insert into public.contacts (owner_id, contact_id)
      values (new.to_user, new.from_user) on conflict do nothing;
    perform public.push_notification(
      new.from_user, new.to_user, 'contact_accepted', null,
      '', 'aceitou seu convite de contato', '{}'::jsonb
    );
  end if;
  return new;
end;
$$;

drop trigger if exists contact_invites_accepted on public.contact_invites;
create trigger contact_invites_accepted
  after update on public.contact_invites
  for each row execute function public.on_contact_invite_accepted();

-- Realtime: convites aparecem/atualizam ao vivo para as duas partes.
alter publication supabase_realtime add table public.contact_invites;

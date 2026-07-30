-- SB Notas — schema inicial (Fase 2)
-- Modelo de dados de docs/03-arquitetura-escopo.md §6, com ajustes de MVP anotados.
-- Rode este arquivo no SQL Editor do Supabase (ou via `supabase db push`).
--
-- Desvios conscientes do docs/03 (pragmatismo de MVP; sem migração dolorosa depois):
--   * profiles ganha `avatar_color` e `plan` (o app já edita isso).
--   * notes.recurrence é `text` (enum do front: once|daily|weekly|monthly) em vez de jsonb.
--   * notes.status restrito a active|archived (o "scheduled" do front é DERIVADO de remind_at).
--   * tags/workspaces (futuro) ficam para uma migração posterior.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensões
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles (1:1 com auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Usuário',
  avatar_url   text,
  avatar_color text not null default '#FACC15',
  plan         text not null default 'Grátis',
  created_at   timestamptz not null default now()
);

-- Cria o profile automaticamente quando um usuário se cadastra no Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- notes (lembrete)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  title        text not null default '',
  body         text not null default '',
  color        text not null default '#FACC15',
  priority     smallint not null default 0,       -- 0 normal, 1 importante, 2 urgente
  pinned       boolean not null default false,
  style        jsonb not null default '{}',       -- customização futura (tamanho, animação…)
  remind_at    timestamptz,                       -- quando disparar (null = sem alarme)
  recurrence   text not null default 'once',      -- once | daily | weekly | monthly
  workspace_id uuid,                              -- futuro
  status       text not null default 'active' check (status in ('active', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists notes_owner_idx     on public.notes (owner_id);
create index if not exists notes_remind_at_idx on public.notes (remind_at);
create index if not exists notes_status_idx    on public.notes (status);

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- note_shares (compartilhamento pessoa -> pessoa)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.note_shares (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.notes(id) on delete cascade,
  shared_with uuid not null references public.profiles(id) on delete cascade,
  permission  text not null default 'view' check (permission in ('view', 'edit')),
  created_at  timestamptz not null default now(),
  unique (note_id, shared_with)
);

create index if not exists note_shares_shared_with_idx on public.note_shares (shared_with);
create index if not exists note_shares_note_idx        on public.note_shares (note_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers SECURITY DEFINER — quebram a recursão entre as políticas de
-- notes <-> note_shares (uma política que consulta a outra reaplicaria RLS).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.owns_note(nid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.notes where id = nid and owner_id = auth.uid());
$$;

create or replace function public.shares_note_with_me(nid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.note_shares
    where note_id = nid and shared_with = auth.uid()
  );
$$;

create or replace function public.can_edit_note(nid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.notes where id = nid and owner_id = auth.uid())
      or exists (
        select 1 from public.note_shares
        where note_id = nid and shared_with = auth.uid() and permission = 'edit'
      );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles    enable row level security;
alter table public.notes       enable row level security;
alter table public.note_shares enable row level security;

-- profiles: qualquer autenticado lê (para exibir nomes/avatares de quem compartilha);
-- cada um edita/insere apenas o próprio.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- notes: ler = dono ou compartilhado comigo; escrever = dono ou 'edit'; excluir = só dono.
drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select to authenticated
  using (owner_id = auth.uid() or public.shares_note_with_me(id));

drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated
  using (public.can_edit_note(id))
  with check (public.can_edit_note(id));

drop policy if exists notes_delete on public.notes;
create policy notes_delete on public.notes
  for delete to authenticated
  using (owner_id = auth.uid());

-- note_shares: ler = quem recebeu ou o dono da nota; criar/alterar/remover = dono da nota.
drop policy if exists note_shares_select on public.note_shares;
create policy note_shares_select on public.note_shares
  for select to authenticated
  using (shared_with = auth.uid() or public.owns_note(note_id));

drop policy if exists note_shares_insert on public.note_shares;
create policy note_shares_insert on public.note_shares
  for insert to authenticated
  with check (public.owns_note(note_id));

drop policy if exists note_shares_update on public.note_shares;
create policy note_shares_update on public.note_shares
  for update to authenticated
  using (public.owns_note(note_id)) with check (public.owns_note(note_id));

drop policy if exists note_shares_delete on public.note_shares;
create policy note_shares_delete on public.note_shares
  for delete to authenticated
  using (public.owns_note(note_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime — publica as tabelas para Postgres Changes (a RLS continua valendo).
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.notes;
alter publication supabase_realtime add table public.note_shares;

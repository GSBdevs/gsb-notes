-- Quadros compartilhados / workspaces (Fase 3). Um quadro é um contêiner: os lembretes
-- pertencem a ele e TODOS os membros veem e criam nele (colaboração em grupo, além do 1:1).
-- Rode no SQL Editor, DEPOIS de 0001→0005. `notes.workspace_id` já existe desde a 0001.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tabelas
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null default 'Quadro',
  color      text not null default '#FACC15',
  created_at timestamptz not null default now()
);

create index if not exists workspaces_owner_idx on public.workspaces (owner_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id)   on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

-- Liga notes.workspace_id (coluna já existia como "futuro"): FK + índice.
-- on delete set null: apagar um quadro solta os lembretes de volta para "Pessoal".
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'notes_workspace_id_fkey' and table_name = 'notes'
  ) then
    alter table public.notes
      add constraint notes_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete set null;
  end if;
end $$;

create index if not exists notes_workspace_idx on public.notes (workspace_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers SECURITY DEFINER — quebram recursão de RLS (mesma técnica da 0001).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_workspace_member(wid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = wid and user_id = auth.uid()
  );
$$;

create or replace function public.owns_workspace(wid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.workspaces where id = wid and owner_id = auth.uid());
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS das novas tabelas
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;

-- workspaces: ver = dono ou membro; criar = você mesmo dono; alterar/excluir = dono.
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select to authenticated
  using (owner_id = auth.uid() or public.is_workspace_member(id));

drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update to authenticated using (public.owns_workspace(id)) with check (public.owns_workspace(id));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete to authenticated using (public.owns_workspace(id));

-- workspace_members: ver = membros e dono; adicionar = só o dono; remover = o dono OU você mesmo (sair).
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using (public.owns_workspace(workspace_id) or public.is_workspace_member(workspace_id));

drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members
  for insert to authenticated with check (public.owns_workspace(workspace_id));

drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members
  for delete to authenticated
  using (public.owns_workspace(workspace_id) or user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Estende a RLS de notes: membros do quadro também leem/criam/editam as notas dele.
-- (Redeclara as políticas da 0001 acrescentando a cláusula de workspace.)
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.shares_note_with_me(id)
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (workspace_id is null or public.is_workspace_member(workspace_id))
  );

drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated
  using (
    public.can_edit_note(id)
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  )
  with check (
    public.can_edit_note(id)
    or (workspace_id is not null and public.is_workspace_member(workspace_id))
  );
-- notes_delete permanece: só o criador (owner_id) exclui a própria nota.

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.workspaces;
alter publication supabase_realtime add table public.workspace_members;

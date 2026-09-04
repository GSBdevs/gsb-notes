-- Hierarquia de usuários — papéis por quadro (RBAC, "Leitura A" de docs/10). Fase 5.
-- Cada membro de um quadro tem um PAPEL: owner | admin | member | viewer. Escopo é o quadro
-- (a mesma pessoa pode ter papéis diferentes em quadros diferentes). Rode DEPOIS de 0018.
--
--   owner  → tudo (renomeia/exclui o quadro, gerencia papéis)
--   admin  → adiciona/remove membros, cria e edita notas do quadro
--   member → cria e edita notas do quadro
--   viewer → só vê

alter table public.workspace_members
  add column if not exists role text not null default 'member'
  check (role in ('owner', 'admin', 'member', 'viewer'));

-- Backfill: o dono do quadro vira 'owner' na própria linha de membro.
update public.workspace_members m
   set role = 'owner'
  from public.workspaces w
 where m.workspace_id = w.id and m.user_id = w.owner_id and m.role <> 'owner';

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers (SECURITY DEFINER — evitam recursão de RLS).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_workspace_admin(wid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.workspaces where id = wid and owner_id = auth.uid())
      or exists (
        select 1 from public.workspace_members
        where workspace_id = wid and user_id = auth.uid() and role in ('owner', 'admin')
      );
$$;

-- Pode EDITAR notas do quadro? (todo papel menos viewer.)
create or replace function public.workspace_role_can_edit(wid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = wid and user_id = auth.uid() and role in ('owner', 'admin', 'member')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- workspace_members: adicionar/remover = ADMINS (era só o dono); trocar PAPEL = só o dono.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members
  for insert to authenticated with check (public.is_workspace_admin(workspace_id));

drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members
  for delete to authenticated
  using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

-- Mudança de papel: só o dono (evita escalonamento de privilégio por admins).
drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members
  for update to authenticated
  using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- notes: VER continua sendo qualquer membro (viewer inclusive); CRIAR/EDITAR no quadro passa a
-- exigir papel com edição (viewer não cria nem edita). Redeclara as políticas da 0006.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (workspace_id is null or public.workspace_role_can_edit(workspace_id))
  );

drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated
  using (
    public.can_edit_note(id)
    or (workspace_id is not null and public.workspace_role_can_edit(workspace_id))
  )
  with check (
    public.can_edit_note(id)
    or (workspace_id is not null and public.workspace_role_can_edit(workspace_id))
  );
-- notes_select (0006) permanece: dono, share 1:1, ou qualquer membro do quadro (viewer vê).

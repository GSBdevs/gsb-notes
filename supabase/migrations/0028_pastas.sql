-- 0028 — "Pastas" (ex-"Quadros"): a pasta passa a ser PESSOAL do dono — os outros usuários NÃO a
-- veem. Os lembretes/tarefas/blocos criados dentro dela são compartilhados INDIVIDUALMENTE
-- (note_shares) com as pessoas da pasta, aparecendo para elas como itens normais compartilhados
-- (mostrando quem fez e com quem), sem expor a pasta no app delas.
--
-- Mantém os dados existentes: faz BACKFILL dos shares a partir dos membros atuais, para que ninguém
-- perca acesso ao que já via. Rode no SQL Editor DEPOIS de 0001→0027. Idempotente.
--
-- A tabela `workspaces`/`workspace_members` é reaproveitada como "pastas"/"pessoas da pasta".
-- O `role` do membro passa a significar só a permissão do compartilhamento: 'viewer' = Ver,
-- qualquer outro ('owner'/'admin'/'member') = Editar.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) BACKFILL (antes de trocar a RLS). Cada item que está numa pasta ganha um share para cada
--    membro atual (menos o dono do próprio item), com a permissão derivada do papel.
--    Assim, quem via por "ser membro do quadro" continua vendo, agora como compartilhado.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.note_shares (note_id, shared_with, permission)
select n.id,
       m.user_id,
       case when m.role = 'viewer' then 'view' else 'edit' end
  from public.notes n
  join public.workspace_members m on m.workspace_id = n.workspace_id
 where n.workspace_id is not null
   and m.user_id <> n.owner_id
on conflict (note_id, shared_with) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) RLS — a pasta vira pessoal; a visibilidade dos itens passa a ser SÓ por dono/compartilhamento.
-- ─────────────────────────────────────────────────────────────────────────────

-- workspaces (pastas): ver = só o dono. (antes: dono OU membro) — criar/alterar/excluir já eram do dono.
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select to authenticated using (owner_id = auth.uid());

-- workspace_members (pessoas da pasta): só o dono da pasta enxerga/gerencia a lista.
-- (insert/update/delete seguem da 0019: dono/admin adiciona; dono muda; dono/você remove.)
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select to authenticated using (public.owns_workspace(workspace_id));

-- notes: VER = dono ou compartilhado comigo; sem mais o atalho "sou membro do quadro".
drop policy if exists notes_select on public.notes;
create policy notes_select on public.notes
  for select to authenticated
  using (owner_id = auth.uid() or public.shares_note_with_me(id));

-- notes: CRIAR só em pasta PRÓPRIA (ou sem pasta). Membros não criam mais na pasta de outro.
drop policy if exists notes_insert on public.notes;
create policy notes_insert on public.notes
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (workspace_id is null or public.owns_workspace(workspace_id))
  );

-- notes: EDITAR = dono ou quem tem compartilhamento de edição (can_edit_note). Sem o atalho de quadro.
drop policy if exists notes_update on public.notes;
create policy notes_update on public.notes
  for update to authenticated
  using (public.can_edit_note(id))
  with check (public.can_edit_note(id));
-- notes_delete permanece: só o criador (owner_id) exclui.

-- Observação: o Realtime de `notes` segue a RLS de SELECT acima — os destinatários recebem as
-- mudanças pelos shares (não mais por membership). `workspaces`/`workspace_members` continuam na
-- publicação realtime (só o dono recebe, o que é o esperado agora).

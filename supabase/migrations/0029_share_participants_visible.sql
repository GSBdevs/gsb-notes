-- 0029 — Mostrar TODOS os participantes de um item (lembrete/tarefa/bloco) a quem participa dele.
--
-- Antes (0001), a RLS de leitura de note_shares era `shared_with = auth.uid() or owns_note(...)`:
-- o DONO via todos os compartilhamentos, mas cada DESTINATÁRIO via só o próprio → não enxergava os
-- co-participantes. Agora: quem pode VER a nota (dono OU compartilhado com ele) vê TODOS os shares
-- dela — assim os avatares de todas as pessoas participando aparecem para todos.
--
-- Só muda o SELECT de note_shares; insert/update/delete continuam restritos ao dono (0001).
-- Rode no SQL Editor DEPOIS de 0028. Idempotente.

drop policy if exists note_shares_select on public.note_shares;
create policy note_shares_select on public.note_shares
  for select to authenticated
  using (public.owns_note(note_id) or public.shares_note_with_me(note_id));

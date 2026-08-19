-- Itens de checklist como TABELA (Fase 5). Antes a checklist da tarefa vivia no jsonb `notes.style`.
-- Isso impedia três coisas que agora são requisito:
--   1. quem só PODE VER marcar/desmarcar itens (a RLS de notes bloqueia update de quem não edita);
--   2. registrar QUEM concluiu cada item e QUANDO;
--   3. a tarefa concluir sozinha quando todos os itens estão marcados.
-- Estrutura (adicionar/renomear/remover/reordenar) = só quem edita. Marcar item (done) = qualquer um
-- que veja a nota, via RPC toggle_checklist_item (SECURITY DEFINER). Rode DEPOIS de 0014→0015.

create table if not exists public.note_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes(id) on delete cascade,
  position   int  not null default 0,
  text       text not null default '',
  done       boolean not null default false,
  done_by    uuid references public.profiles(id) on delete set null,
  done_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists note_checklist_items_note_idx on public.note_checklist_items (note_id, position);

alter table public.note_checklist_items enable row level security;

-- Ver: qualquer um que veja a nota (dono, share 1:1, membro do quadro).
drop policy if exists note_checklist_items_select on public.note_checklist_items;
create policy note_checklist_items_select on public.note_checklist_items
  for select to authenticated using (public.can_see_note(note_id));

-- Criar / renomear (update de texto/posição) / remover: só quem edita a nota.
-- (O toggle de `done` de não-editores passa pela RPC abaixo, que ignora estas policies.)
drop policy if exists note_checklist_items_insert on public.note_checklist_items;
create policy note_checklist_items_insert on public.note_checklist_items
  for insert to authenticated with check (public.can_edit_note(note_id));

drop policy if exists note_checklist_items_update on public.note_checklist_items;
create policy note_checklist_items_update on public.note_checklist_items
  for update to authenticated using (public.can_edit_note(note_id)) with check (public.can_edit_note(note_id));

drop policy if exists note_checklist_items_delete on public.note_checklist_items;
create policy note_checklist_items_delete on public.note_checklist_items
  for delete to authenticated using (public.can_edit_note(note_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Marcar/desmarcar um item: liberado a QUALQUER um que veja a nota. Registra quem/quando
-- e conclui (ou reabre) a tarefa automaticamente conforme todos os itens. SECURITY DEFINER
-- roda como owner (ignora RLS) — por isso um "viewer" consegue concluir a tarefa marcando itens.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.toggle_checklist_item(p_item uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_note uuid; v_total int; v_done int;
begin
  select note_id into v_note from public.note_checklist_items where id = p_item;
  if v_note is null then
    raise exception 'Item não encontrado';
  end if;
  if not public.can_see_note(v_note) then
    raise exception 'Sem permissão para este item';
  end if;

  update public.note_checklist_items
     set done    = p_done,
         done_by = case when p_done then auth.uid() else null end,
         done_at = case when p_done then now() else null end
   where id = p_item;

  select count(*), count(*) filter (where done) into v_total, v_done
    from public.note_checklist_items where note_id = v_note;

  -- Todos os itens feitos → tarefa concluída; qualquer um desfeito → reabre.
  if v_total > 0 and v_done = v_total then
    update public.notes set status = 'archived' where id = v_note and status <> 'archived';
  elsif v_total > 0 and v_done < v_total then
    update public.notes set status = 'active' where id = v_note and status = 'archived';
  end if;
end;
$$;

grant execute on function public.toggle_checklist_item(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Item concluído (done false → true) → avisa o dono da nota quem concluiu.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_checklist_item_done()
returns trigger language plpgsql security definer set search_path = public as $$
declare n record;
begin
  if new.done and not old.done then
    select title, owner_id into n from public.notes where id = new.note_id;
    perform public.push_notification(
      n.owner_id, auth.uid(), 'checklist_item_done', new.note_id,
      coalesce(n.title, ''), 'concluiu um item: ' || new.text,
      jsonb_build_object('item', new.text)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists checklist_items_notify_done on public.note_checklist_items;
create trigger checklist_items_notify_done
  after update of done on public.note_checklist_items
  for each row execute function public.notify_checklist_item_done();

-- ─────────────────────────────────────────────────────────────────────────────
-- Migração dos checklists que já existem no jsonb `notes.style` → linhas da nova tabela.
-- Depois, remove a chave `checklist` do style (a tabela passa a ser a única fonte).
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.note_checklist_items (note_id, position, text, done)
select n.id, (arr.idx - 1)::int, coalesce(arr.item->>'text', ''),
       coalesce((arr.item->>'done')::boolean, false)
from public.notes n
cross join lateral jsonb_array_elements(coalesce(n.style->'checklist', '[]'::jsonb))
     with ordinality as arr(item, idx)
where n.kind = 'doc'
  and jsonb_typeof(n.style->'checklist') = 'array'
  and not exists (select 1 from public.note_checklist_items i where i.note_id = n.id);

update public.notes
   set style = style - 'checklist'
 where kind = 'doc' and style ? 'checklist';

-- Realtime: marcar/adicionar/remover item reflete ao vivo em quem está com a tarefa aberta.
alter publication supabase_realtime add table public.note_checklist_items;

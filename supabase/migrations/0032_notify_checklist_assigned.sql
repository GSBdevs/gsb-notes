-- 0032 — Notificar o RESPONSÁVEL quando um item de checklist é direcionado a ele (assignee).
-- Faltava: a atribuição (0021) só gravava a coluna `assignee` e mostrava o badge no editor — mas o
-- destinatário não recebia NENHUM sinal; o direcionamento "não aparecia" para ele a menos que abrisse
-- justo aquela tarefa e achasse o item. Espelha o notify_checklist_item_done (0016), mudando o alvo:
-- aqui quem é avisado é o PRÓPRIO responsável (push_notification já ignora quando é o próprio autor).
-- Rode no SQL Editor DEPOIS de 0021 (coluna assignee) e 0016 (push_notification/notifications). Idempotente.

create or replace function public.notify_checklist_item_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare n record;
begin
  -- Só quando passa a ter um responsável (ignora limpar) e, no update, só se o responsável MUDOU.
  if new.assignee is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee is not distinct from old.assignee then
    return new;
  end if;

  select title, owner_id into n from public.notes where id = new.note_id;
  perform public.push_notification(
    new.assignee, auth.uid(), 'checklist_item_assigned', new.note_id,
    coalesce(n.title, ''), 'direcionou um item a você: ' || new.text,
    jsonb_build_object('item', new.text)
  );
  return new;
end;
$$;

-- `of assignee`: só dispara quando a atribuição está no SET do UPDATE (renomear/concluir item não dispara).
drop trigger if exists checklist_items_notify_assigned on public.note_checklist_items;
create trigger checklist_items_notify_assigned
  after insert or update of assignee on public.note_checklist_items
  for each row execute function public.notify_checklist_item_assigned();

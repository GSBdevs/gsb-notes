-- 0033 — Desmarcar item de checklist: só quem MARCOU (done_by) ou o AUTOR (dono da nota).
-- Antes (0016), a RPC toggle_checklist_item liberava marcar E desmarcar a qualquer um que visse a
-- nota. Agora: MARCAR (aberto → concluído) continua liberado a qualquer participante; DESMARCAR
-- (concluído → aberto) é restrito a quem concluiu o item ou ao dono da tarefa — ninguém "desfaz" a
-- conclusão alheia. Continua SECURITY DEFINER (roda como owner) para o viewer conseguir marcar.
-- Rode no SQL Editor DEPOIS de 0016. Idempotente (create or replace).

create or replace function public.toggle_checklist_item(p_item uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_note uuid; v_owner uuid; v_done_by uuid; v_total int; v_done int;
begin
  select ci.note_id, ci.done_by, n.owner_id
    into v_note, v_done_by, v_owner
    from public.note_checklist_items ci
    join public.notes n on n.id = ci.note_id
   where ci.id = p_item;
  if v_note is null then
    raise exception 'Item não encontrado';
  end if;
  if not public.can_see_note(v_note) then
    raise exception 'Sem permissão para este item';
  end if;

  -- DESMARCAR: só quem concluiu (done_by) ou o autor (dono da nota). Marcar segue liberado a todos.
  if not p_done and v_done_by is not null
     and auth.uid() <> v_done_by and auth.uid() <> v_owner then
    raise exception 'Só quem concluiu o item ou o autor da tarefa pode desmarcá-lo';
  end if;

  update public.note_checklist_items
     set done    = p_done,
         done_by = case when p_done then auth.uid() else null end,
         done_at = case when p_done then now() else null end
   where id = p_item;

  select count(*), count(*) filter (where done) into v_total, v_done
    from public.note_checklist_items where note_id = v_note;

  -- Todos feitos → tarefa concluída; qualquer um desfeito → reabre.
  if v_total > 0 and v_done = v_total then
    update public.notes set status = 'archived' where id = v_note and status <> 'archived';
  elsif v_total > 0 and v_done < v_total then
    update public.notes set status = 'active' where id = v_note and status = 'archived';
  end if;
end;
$$;

grant execute on function public.toggle_checklist_item(uuid, boolean) to authenticated;

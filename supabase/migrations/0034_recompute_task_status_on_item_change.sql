-- 0034 — Recalcular a conclusão da tarefa quando itens são ADICIONADOS ou EXCLUÍDOS.
-- Bug: a auto-conclusão (todos os itens marcados → tarefa 'archived') só era recalculada no TOGGLE
-- (RPC toggle_checklist_item, 0016). Excluir um item não recalculava nada: uma tarefa com
-- [A feito, B em aberto] que perde o B ficava ATIVA mesmo com tudo que resta concluído — e, como
-- tarefa COM itens não tem botão "Concluir" manual, ela nunca ia para Concluídos. Simétrico no
-- ADD: inserir um item em aberto numa tarefa concluída deve REABRI-LA.
-- Mesma regra do toggle. SECURITY DEFINER (edita notes.status como o toggle já faz). O update de
-- status dispara os gatilhos de sempre (set_completed_at/0031 + notify_task_completed/0014).
-- Rode no SQL Editor DEPOIS de 0016. Idempotente.

create or replace function public.recompute_task_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_note uuid; v_total int; v_done int;
begin
  if tg_op = 'DELETE' then
    v_note := old.note_id;
  else
    v_note := new.note_id;
  end if;

  select count(*), count(*) filter (where done) into v_total, v_done
    from public.note_checklist_items where note_id = v_note;

  if v_total > 0 and v_done = v_total then
    update public.notes set status = 'archived' where id = v_note and status <> 'archived';
  elsif v_total > 0 and v_done < v_total then
    update public.notes set status = 'active' where id = v_note and status = 'archived';
  end if;
  -- total = 0 (tarefa ficou sem itens): não mexe — itemless conclui manualmente.
  return null;
end;
$$;

-- Só INSERT/DELETE: o UPDATE de `done` já é tratado dentro da RPC toggle_checklist_item.
drop trigger if exists checklist_items_recompute_status on public.note_checklist_items;
create trigger checklist_items_recompute_status
  after insert or delete on public.note_checklist_items
  for each row execute function public.recompute_task_status();

-- 0036 — Item de checklist "NÃO FEITO" (✗ vermelho), além do "feito" (✓ verde).
-- Ao concluir um item, o usuário escolhe o desfecho: feito ou não feito. Os DOIS contam como
-- RESOLVIDO — a tarefa conclui sozinha quando todos os itens estão resolvidos, qualquer que seja o tipo.
-- Modelo: `done` continua significando "resolvido" (toda a lógica de auto-conclusão 0016/0033/0034
-- segue igual); a coluna nova `failed` diz se o desfecho foi "não feito" (só vale com done = true).
--
-- IMPORTANTE: rode ANTES de publicar a versão do app que lê `failed` (o app passa a pedir a coluna).
-- Rode DEPOIS de 0033/0034. Idempotente.

alter table public.note_checklist_items
  add column if not exists failed boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────────
-- Resolver/reabrir um item com desfecho. Mesmas regras da 0033: RESOLVER é livre a quem vê a nota;
-- REABRIR (resolvido → aberto) só quem resolveu (done_by) ou o autor. Trocar ✓↔✗ de um item já
-- resolvido segue a mesma regra de reabrir (é mexer na resolução de alguém).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_checklist_item(p_item uuid, p_done boolean, p_failed boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_note uuid; v_owner uuid; v_done_by uuid; v_was_done boolean; v_total int; v_done int;
begin
  select ci.note_id, ci.done_by, ci.done, n.owner_id
    into v_note, v_done_by, v_was_done, v_owner
    from public.note_checklist_items ci
    join public.notes n on n.id = ci.note_id
   where ci.id = p_item;
  if v_note is null then
    raise exception 'Item não encontrado';
  end if;
  if not public.can_see_note(v_note) then
    raise exception 'Sem permissão para este item';
  end if;

  if v_was_done and v_done_by is not null
     and auth.uid() <> v_done_by and auth.uid() <> v_owner then
    raise exception 'Só quem concluiu o item ou o autor da tarefa pode alterá-lo';
  end if;

  update public.note_checklist_items
     set done    = p_done,
         failed  = p_done and coalesce(p_failed, false),
         done_by = case when p_done then auth.uid() else null end,
         done_at = case when p_done then now() else null end
   where id = p_item;

  select count(*), count(*) filter (where done) into v_total, v_done
    from public.note_checklist_items where note_id = v_note;

  -- Todos resolvidos (feitos OU não feitos) → tarefa concluída; algum aberto → reabre.
  if v_total > 0 and v_done = v_total then
    update public.notes set status = 'archived' where id = v_note and status <> 'archived';
  elsif v_total > 0 and v_done < v_total then
    update public.notes set status = 'active' where id = v_note and status = 'archived';
  end if;
end;
$$;

grant execute on function public.resolve_checklist_item(uuid, boolean, boolean) to authenticated;

-- Versões antigas do app ainda chamam toggle_checklist_item: vira um atalho para "feito"/reabrir.
create or replace function public.toggle_checklist_item(p_item uuid, p_done boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.resolve_checklist_item(p_item, p_done, false);
end;
$$;

grant execute on function public.toggle_checklist_item(uuid, boolean) to authenticated;

-- Aviso ao dono: diferencia "concluiu" de "marcou como não feito".
create or replace function public.notify_checklist_item_done()
returns trigger language plpgsql security definer set search_path = public as $$
declare n record;
begin
  if new.done and not old.done then
    select title, owner_id into n from public.notes where id = new.note_id;
    perform public.push_notification(
      n.owner_id, auth.uid(), 'checklist_item_done', new.note_id,
      coalesce(n.title, ''),
      case when new.failed then 'marcou como não feito: ' else 'concluiu um item: ' end || new.text,
      jsonb_build_object('item', new.text, 'failed', new.failed)
    );
  end if;
  return new;
end;
$$;

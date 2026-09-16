-- Notificação de COMENTÁRIO numa nota (pedido do dono). Quando alguém comenta num lembrete/tarefa,
-- avisa todos os participantes (dono + shares 1:1 + membros do quadro), menos o autor. Tipo novo:
-- 'note_comment'. Reusa push_notification (0014). A coluna `type` é texto livre (sem CHECK), então
-- não precisa alterar constraint. Rode no SQL Editor DEPOIS de 0014 (e da 0009 dos comentários).

create or replace function public.notify_note_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec record; n record;
begin
  select title, kind, owner_id, workspace_id into n from public.notes where id = new.note_id;
  for rec in
    select uid from (
      select shared_with as uid from public.note_shares where note_id = new.note_id
      union
      select user_id from public.workspace_members
        where n.workspace_id is not null and workspace_id = n.workspace_id
      union
      select n.owner_id
    ) t
    where uid is distinct from new.author_id
  loop
    perform public.push_notification(
      rec.uid, new.author_id, 'note_comment', new.note_id,
      coalesce(n.title, ''), 'comentou em ' || public.note_kind_noun(n.kind),
      jsonb_build_object('preview', left(new.body, 120))
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists note_comments_notify on public.note_comments;
create trigger note_comments_notify
  after insert on public.note_comments
  for each row execute function public.notify_note_comment();

-- 0030 — Notificações de nota passam a seguir o COMPARTILHAMENTO, não a "membership da pasta".
--
-- No modelo de Pastas (0028/hotfix 05/10) um item numa pasta é compartilhado POR ITEM — só com quem
-- foi marcado. As notificações precisam acompanhar:
--   * criar um item numa pasta NÃO deve mais avisar "criou no quadro" para todos os membros;
--   * avisar só quem REALMENTE recebeu (trigger de note_shares → "compartilhou X com você", geral);
--   * nada para item "Pessoal" (sem shares) nem para pessoas desmarcadas (sem share);
--   * texto geral (sem "no quadro" / "foi adicionado em").
-- Rode no SQL Editor DEPOIS de 0029. Idempotente.

-- 1) Fim do aviso "criou no quadro" para os membros da pasta. A notificação de item novo agora vem
--    só do compartilhamento (o trigger note_shares_notify → notify_note_shared já diz "compartilhou
--    <o lembrete/a tarefa> com você", e só para quem recebeu o share).
drop trigger if exists notes_notify_created on public.notes;
drop function if exists public.notify_note_created();

-- 2) Editar uma nota avisa só os PARTICIPANTES reais (dono + quem tem share), não os membros da pasta.
create or replace function public.notify_note_edited()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  if (new.title, new.body, new.color, new.priority, new.recurrence)
       is not distinct from (old.title, old.body, old.color, old.priority, old.recurrence)
     and new.tags is not distinct from old.tags then
    return new; -- nada de conteúdo mudou
  end if;
  for rec in
    select uid from (
      select shared_with as uid from public.note_shares where note_id = new.id
      union
      select new.owner_id
    ) t
    where uid is distinct from auth.uid()
  loop
    perform public.push_notification(
      rec.uid, auth.uid(), 'note_edited', new.id,
      new.title, 'editou ' || public.note_kind_noun(new.kind), '{}'::jsonb
    );
  end loop;
  return new;
end;
$$;

-- 3) Concluir uma tarefa avisa só os participantes reais (dono + quem tem share).
create or replace function public.notify_task_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  if new.kind <> 'doc' or new.status <> 'archived' or old.status = 'archived' then
    return new;
  end if;
  for rec in
    select uid from (
      select shared_with as uid from public.note_shares where note_id = new.id
      union
      select new.owner_id
    ) t
    where uid is distinct from auth.uid()
  loop
    perform public.push_notification(
      rec.uid, auth.uid(), 'task_completed', new.id,
      new.title, 'concluiu a tarefa', '{}'::jsonb
    );
  end loop;
  return new;
end;
$$;

-- 4) Auto-mensagem de DM ao compartilhar: texto GERAL (sem "foi adicionado em"). Continua por-share
--    (só quem recebeu), então "Pessoal" e desmarcados já não recebem.
create or replace function public.dm_notify_share()
returns trigger language plpgsql security definer set search_path = public as $$
declare n record; cid uuid;
begin
  select owner_id, title, kind into n from public.notes where id = new.note_id;
  if n.owner_id is null or n.owner_id = new.shared_with then return new; end if;
  cid := public.dm_conversation_for(n.owner_id, new.shared_with);
  insert into public.dm_messages (conversation_id, sender_id, body, system, ref_note_id, ref_kind, ref_title)
  values (cid, n.owner_id,
          'Compartilhou com você: ' || coalesce(nullif(n.title, ''), '(sem título)'),
          true, new.note_id, n.kind, n.title);
  return new;
end;
$$;

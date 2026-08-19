-- Webhooks (Fase 4 — integrações). O usuário cadastra uma URL (Ajustes) e o banco faz um
-- POST JSON nela quando um lembrete dele é: criado, concluído ou disparado (push enviado).
-- Usa pg_net (a mesma extensão do cron do Web Push). Falha de webhook NUNCA quebra a escrita.
-- Rode no SQL Editor DEPOIS de 0001→0012.

create extension if not exists pg_net;

alter table public.profiles add column if not exists webhook_url text;

create or replace function public.notify_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hook text;
  evt  text;
begin
  select webhook_url into hook from public.profiles where id = new.owner_id;
  if hook is null or hook !~* '^https://' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    evt := 'nota.criada';
  elsif new.status = 'archived' and old.status is distinct from 'archived' then
    evt := 'nota.concluida';
  elsif new.pushed_at is distinct from old.pushed_at then
    evt := 'nota.disparada';
  else
    return new;
  end if;

  begin
    perform net.http_post(
      url     := hook,
      body    := jsonb_build_object(
        'event', evt,
        'note', jsonb_build_object(
          'id', new.id,
          'title', new.title,
          'kind', new.kind,
          'status', new.status,
          'remind_at', new.remind_at
        ),
        'at', now()
      ),
      headers := jsonb_build_object('content-type', 'application/json')
    );
  exception when others then
    null; -- webhook fora do ar não pode travar o app
  end;

  return new;
end;
$$;

drop trigger if exists notes_webhook_insert on public.notes;
create trigger notes_webhook_insert
  after insert on public.notes
  for each row execute function public.notify_webhook();

drop trigger if exists notes_webhook_update on public.notes;
create trigger notes_webhook_update
  after update of status, pushed_at on public.notes
  for each row execute function public.notify_webhook();

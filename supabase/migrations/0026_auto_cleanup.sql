-- Limpeza automática (a cada 30 dias): remove notificações antigas e lembretes/tarefas CONCLUÍDOS
-- (status 'archived') antigos. Roda diariamente via pg_cron. Rode DEPOIS de 0025.
--
-- Regras:
--   * notificações (sino): apagadas quando têm mais de 30 dias (created_at).
--   * lembretes e tarefas CONCLUÍDOS: apagados 30 dias após a conclusão (proxy: updated_at, que
--     marca o momento em que viraram 'archived'; itens concluídos não costumam ser editados depois).
--   * blocos e itens ativos NÃO são tocados.

create or replace function public.cleanup_old_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Notificações do sino com mais de 30 dias.
  delete from public.notifications
   where created_at < now() - interval '30 days';

  -- Lembretes (kind 'reminder') e tarefas (kind 'doc') concluídos há mais de 30 dias.
  delete from public.notes
   where kind in ('reminder', 'doc')
     and status = 'archived'
     and updated_at < now() - interval '30 days';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Agendamento diário (03:00) via pg_cron. Requer a extensão pg_cron habilitada no projeto
-- (Dashboard → Database → Extensions, ou o create abaixo). Idempotente: desagenda antes de reagendar.
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('sbnotas-cleanup-old-data');
exception
  when others then null; -- ainda não existe: segue
end
$$;

select cron.schedule(
  'sbnotas-cleanup-old-data',
  '0 3 * * *',
  $$ select public.cleanup_old_data(); $$
);

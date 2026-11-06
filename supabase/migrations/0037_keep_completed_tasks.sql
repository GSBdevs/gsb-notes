-- 0037 — Tarefas concluídas NÃO são mais excluídas automaticamente.
-- A limpeza diária (0026) apagava lembretes E tarefas concluídos há mais de 30 dias. Agora só os
-- LEMBRETES concluídos expiram; tarefas (kind 'doc') ficam guardadas em Concluídas indefinidamente.
-- Chamados (kind 'call', 0035) e blocos já não eram tocados. O agendamento pg_cron da 0026 continua
-- o mesmo (chama esta função). Rode DEPOIS de 0026. Idempotente.

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

  -- Só LEMBRETES concluídos há mais de 30 dias (tarefas concluídas são mantidas).
  delete from public.notes
   where kind = 'reminder'
     and status = 'archived'
     and updated_at < now() - interval '30 days';
end;
$$;

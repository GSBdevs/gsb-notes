-- 0031 — completed_at: marca QUANDO um item (lembrete/tarefa) foi concluído (status → 'archived').
-- Habilita as métricas da aba "Concluídos" (painel de teste, só master).
--
-- IMPACTO EM OUTROS USUÁRIOS / VERSÕES ANTIGAS (leia):
--   • A coluna é NOVA e NULÁVEL → versões antigas do app simplesmente a ignoram.
--   • O gatilho só PREENCHE a coluna nas conclusões de qualquer usuário (e a limpa ao restaurar).
--     É invisível: nenhuma mudança de UI, comportamento ou notificação para ninguém. Serve só para a
--     métrica ter dados. (Capturar aqui, no banco, é o único jeito de pegar TAMBÉM as tarefas que
--     concluem sozinhas via toggle_checklist_item, independente da versão do app.)
--   • Itens JÁ arquivados antes desta migração ficam com completed_at = NULL (sem backfill — não dá
--     para inventar a data; o painel conta no total, mas fora das métricas por tempo).
-- Rode no SQL Editor. Idempotente.

alter table public.notes add column if not exists completed_at timestamptz;

-- Carimba/limpa completed_at conforme o status entra/sai de 'archived'. BEFORE trigger: só ajusta a
-- linha que já está sendo gravada (sem SECURITY DEFINER; roda com as permissões de quem edita).
create or replace function public.set_completed_at()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'archived' and new.completed_at is null then
      new.completed_at := now();
    end if;
    return new;
  end if;
  if new.status = 'archived' and old.status is distinct from 'archived' then
    new.completed_at := now();        -- concluiu agora
  elsif new.status is distinct from 'archived' and old.status = 'archived' then
    new.completed_at := null;         -- restaurou → deixa de ser concluído
  end if;
  return new;
end;
$$;

drop trigger if exists notes_set_completed_at on public.notes;
create trigger notes_set_completed_at
  before insert or update on public.notes
  for each row execute function public.set_completed_at();

-- 0039 — Logística LIBERADA para todos (fim da fase de teste da 0038).
-- Todos os usuários autenticados passam a VER as rotas (ativas e o histórico de concluídos, global).
-- Editar continua restrito: Master/Admin/Suporte gerenciam; técnico edita só a rota dele (0038).
-- Rode ANTES de publicar a versão que mostra a aba para todos. Idempotente.

create or replace function public.can_view_routes()
returns boolean language sql security definer stable set search_path = public as $$
  select true;
$$;

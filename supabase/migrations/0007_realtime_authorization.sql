-- Hardening do "disparar agora" (Realtime Authorization). Fecha o canal pessoal de
-- broadcast: hoje `sb-notas:user:<id>` é público — qualquer autenticado poderia ouvir
-- ou injetar "fire" no canal de outra pessoa. Passa a: (1) canal PRIVADO, cada um ouve só
-- o próprio; (2) o disparo vai por RPC autorizada (não mais cliente→canal alheio).
-- Rode no SQL Editor DEPOIS de 0001→0006. Requer uma versão do Supabase com `realtime.send`.
--
-- ⚠️ Ordem de deploy: rode ESTA migração ANTES de publicar o build novo do app. O cliente
-- passa a assinar o canal como privado; sem a política de leitura abaixo, o "fire" ao vivo
-- deixa de chegar (degrada em silêncio — o app não quebra).

-- NÃO habilite RLS aqui: `realtime.messages` já vem com RLS LIGADA por padrão no Supabase, e a
-- tabela pertence ao papel do Realtime — `alter table ... enable row level security` falha com
-- "must be owner of table messages". Só criamos as políticas abaixo (isso o Supabase permite).
-- A RLS de realtime.messages só é consultada para canais PRIVADOS; os públicos (presença,
-- postgres_changes) seguem intactos.

-- Leitura: cada usuário recebe apenas o próprio canal `sb-notas:user:<uid>`.
drop policy if exists sb_notas_receive_own_user_channel on realtime.messages;
create policy sb_notas_receive_own_user_channel
  on realtime.messages
  for select
  to authenticated
  using (realtime.topic() = 'sb-notas:user:' || (select auth.uid())::text);

-- Sem política de INSERT para clientes: ninguém escreve direto num canal privado.
-- O disparo entra só pela RPC abaixo (SECURITY DEFINER → dona da função → ignora RLS ao enviar).

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC de disparo autorizado: emite "fire" no canal do alvo, checando que EU (dono da
-- nota) realmente compartilho este lembrete com ele — por share 1:1 OU por quadro.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.broadcast_fire(target_user uuid, reminder_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.notes n
    where n.id = reminder_id
      and n.owner_id = auth.uid()  -- só o dono dispara
      and (
        exists (
          select 1 from public.note_shares s
          where s.note_id = n.id and s.shared_with = target_user
        )
        or (
          n.workspace_id is not null
          and exists (
            select 1 from public.workspace_members m
            where m.workspace_id = n.workspace_id and m.user_id = target_user
          )
        )
      )
  ) then
    raise exception 'nao autorizado a disparar este lembrete para esse usuario';
  end if;

  perform realtime.send(
    jsonb_build_object('reminderId', reminder_id::text), -- payload
    'fire',                                              -- event
    'sb-notas:user:' || target_user::text,               -- topic (canal privado do alvo)
    true                                                 -- private
  );
end;
$$;

grant execute on function public.broadcast_fire(uuid, uuid) to authenticated;
x 
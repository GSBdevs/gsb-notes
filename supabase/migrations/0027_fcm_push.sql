-- Push nativo (Android/Capacitor via FCM) — Fase Android. As notificações de app (contato
-- adicionado, DM, edição, tarefa concluída) são geradas por triggers na 0014/0015/0016/0023, mas
-- só CHEGAM no cliente enquanto o app está vivo (Realtime). Com o app FECHADO/2º plano no Android,
-- o WebView congela e nada dispara. Esta migração fecha essa lacuna: ao nascer uma `notification`
-- (e uma `dm_message` real), um trigger chama a Edge Function `send-push`, que envia FCM aos
-- dispositivos do destinatário — o Android mostra a notificação mesmo com o app morto.
--
-- Rode no SQL Editor DEPOIS de 0001→0026. Requer pg_net (já habilitado na 0013).
--
-- CONFIG (rode UMA vez, com os SEUS valores — não ficam no repositório):
--   insert into private.push_config (id, url, secret) values (
--     1,
--     'https://<SEU-REF>.supabase.co/functions/v1/send-push',
--     '<UM-SEGREDO-ALEATÓRIO>'      -- o MESMO valor do secret PUSH_SECRET da Edge Function
--   ) on conflict (id) do update set url = excluded.url, secret = excluded.secret;

create extension if not exists pg_net;

-- ── Tokens FCM (um por dispositivo/instalação do usuário) ─────────────────────────────────────
create table if not exists public.fcm_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique,           -- registration token do FCM (identifica o device)
  platform   text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fcm_tokens_user_idx on public.fcm_tokens (user_id);

alter table public.fcm_tokens enable row level security;

-- Cada um gerencia apenas os próprios tokens. (A Edge Function usa service_role e ignora RLS.)
drop policy if exists fcm_tokens_select on public.fcm_tokens;
create policy fcm_tokens_select on public.fcm_tokens
  for select to authenticated using (user_id = auth.uid());
drop policy if exists fcm_tokens_insert on public.fcm_tokens;
create policy fcm_tokens_insert on public.fcm_tokens
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists fcm_tokens_update on public.fcm_tokens;
create policy fcm_tokens_update on public.fcm_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists fcm_tokens_delete on public.fcm_tokens;
create policy fcm_tokens_delete on public.fcm_tokens
  for delete to authenticated using (user_id = auth.uid());

-- ── Config do dispatcher (schema privado, NÃO exposto pelo PostgREST) ─────────────────────────
create schema if not exists private;
create table if not exists private.push_config (
  id     int primary key default 1,
  url    text not null default '',
  secret text not null default '',
  constraint push_config_singleton check (id = 1)
);

-- ── Dispatcher: POST assíncrono (pg_net) p/ a Edge Function. Falha NUNCA trava a escrita. ─────
create or replace function public.fcm_dispatch(p_table text, p_record jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare cfg record;
begin
  select url, secret into cfg from private.push_config where id = 1;
  if cfg.url is null or cfg.url = '' then
    return; -- não configurado ainda: no-op silencioso
  end if;
  begin
    perform net.http_post(
      url     := cfg.url,
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-push-secret', coalesce(cfg.secret, '')
      ),
      body    := jsonb_build_object('table', p_table, 'record', p_record)
    );
  exception when others then
    null; -- FCM/rede fora do ar não pode travar o app
  end;
end;
$$;

-- Nova notificação do sino → push (contato/edição/tarefa/convite etc.).
create or replace function public.fcm_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.fcm_dispatch('notifications', to_jsonb(new));
  return new;
end;
$$;
drop trigger if exists notifications_fcm on public.notifications;
create trigger notifications_fcm after insert on public.notifications
  for each row execute function public.fcm_on_notification();

-- Nova DM (não-automática) → push. Mensagens `system` ("você foi adicionado…") já viram uma
-- notification (0014) e seriam empurradas por lá — pular aqui evita push em dobro.
create or replace function public.fcm_on_dm()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.system then return new; end if;
  perform public.fcm_dispatch('dm_messages', to_jsonb(new));
  return new;
end;
$$;
drop trigger if exists dm_messages_fcm on public.dm_messages;
create trigger dm_messages_fcm after insert on public.dm_messages
  for each row execute function public.fcm_on_dm();

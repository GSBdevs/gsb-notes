-- Web Push (Fase 3 — app 100% fechado na PWA). Guarda as inscrições de push do navegador
-- e marca quando um lembrete já foi despachado por push (evita reenvio a cada minuto do cron).
-- Rode no SQL Editor DEPOIS de 0001→0007. O envio em si é feito pela Edge Function
-- `dispatch-reminders-push` (ver supabase/functions/), agendada por pg_cron.

-- ─────────────────────────────────────────────────────────────────────────────
-- Inscrições de push (uma por dispositivo/navegador do usuário)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,           -- URL única do push service (identifica o device)
  p256dh     text not null,                  -- chave pública do cliente (criptografia do payload)
  auth       text not null,                  -- segredo de autenticação do cliente
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Cada um gerencia apenas as próprias inscrições. (A Edge Function usa service_role e ignora RLS.)
drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Dedup do dispatcher: marca o instante em que o lembrete foi despachado por push.
-- O cron reenvia só quando remind_at avança (ex.: recorrência) além do último push.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.notes add column if not exists pushed_at timestamptz;

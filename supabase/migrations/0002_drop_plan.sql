-- Remove o conceito de "plano" do perfil (não usado no produto).
-- Rode no SQL Editor do Supabase (ou via `supabase db push`).
alter table public.profiles drop column if exists plan;

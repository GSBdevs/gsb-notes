-- Figurinhas (stickers) — cada usuário sobe as próprias imagens e envia nas DMs (estilo WhatsApp).
-- Ver internal/docs/12 §5 (storage). Rode DEPOIS de 0024.
--
-- Bucket 'stickers' PÚBLICO (as figurinhas circulam nas conversas, como os assets de mídia de um
-- chat): a LEITURA é pública (URL estável, sem assinar), mas ESCRITA/EXCLUSÃO ficam isoladas por
-- pasta = auth.uid() (ninguém mexe na figurinha de outro). O caminho traz um UUID (não é adivinhável).

-- ─────────────────────────────────────────────────────────────────────────────
-- Bucket + políticas de storage
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('stickers', 'stickers', true, 2097152,
        array['image/png','image/webp','image/jpeg','image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists stickers_insert_own on storage.objects;
create policy stickers_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists stickers_update_own on storage.objects;
create policy stickers_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists stickers_delete_own on storage.objects;
create policy stickers_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'stickers' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- Pacotes e figurinhas (biblioteca de cada usuário)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sticker_packs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null default 'Meu pacote',
  created_at timestamptz not null default now()
);
create index if not exists sticker_packs_owner_idx on public.sticker_packs (owner_id);

create table if not exists public.stickers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  pack_id      uuid references public.sticker_packs(id) on delete set null,
  path         text not null,          -- caminho no bucket 'stickers' (ex.: <uid>/<uuid>.webp)
  mime         text not null default 'image/png',
  last_used_at timestamptz,            -- p/ a aba "recentes" (null = nunca usada)
  created_at   timestamptz not null default now()
);
create index if not exists stickers_owner_idx on public.stickers (owner_id);
create index if not exists stickers_recent_idx on public.stickers (owner_id, last_used_at desc);

alter table public.sticker_packs enable row level security;
alter table public.stickers      enable row level security;

-- Biblioteca é privada do dono: só ele lê/gerencia. (As DMs carregam o caminho da figurinha
-- diretamente na mensagem, então o destinatário NÃO precisa ler esta tabela.)
drop policy if exists sticker_packs_all_own on public.sticker_packs;
create policy sticker_packs_all_own on public.sticker_packs
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists stickers_all_own on public.stickers;
create policy stickers_all_own on public.stickers
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- DM: mensagem pode carregar uma figurinha (caminho no bucket público).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.dm_messages add column if not exists sticker_path text;

-- Contatos (Fase 4 — gerenciamento de pessoas). Antes, "Pessoas" era só derivado de
-- compartilhamentos; agora dá para ADICIONAR alguém por e-mail sem compartilhar nada ainda —
-- a pessoa vira contato, aparece na aba Pessoas e nas sugestões de 1 clique do editor.
-- Rode no SQL Editor DEPOIS de 0001→0010.

create table if not exists public.contacts (
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);

create index if not exists contacts_owner_idx on public.contacts (owner_id);

alter table public.contacts enable row level security;

-- Cada um gerencia apenas a própria lista de contatos.
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
  for delete to authenticated using (owner_id = auth.uid());

-- "Visto por" / read receipts (Fase 3). Registra quando cada destinatário VIU um
-- lembrete compartilhado (o disparo chamativo apareceu na tela dele). O dono usa
-- isso para saber quem já viu. Rode no SQL Editor, DEPOIS das migrações 0001→0004.
create table if not exists public.note_reads (
  note_id  uuid not null references public.notes(id)    on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  seen_at  timestamptz not null default now(),
  primary key (note_id, user_id)
);

create index if not exists note_reads_note_idx on public.note_reads (note_id);

alter table public.note_reads enable row level security;

-- Ler: o dono da nota (vê todos os recibos) OU o próprio leitor (vê só o seu).
-- Reaproveita owns_note() (SECURITY DEFINER) da 0001 para evitar recursão de RLS.
drop policy if exists note_reads_select on public.note_reads;
create policy note_reads_select on public.note_reads
  for select to authenticated
  using (user_id = auth.uid() or public.owns_note(note_id));

-- Gravar/atualizar o próprio recibo, e só em nota compartilhada comigo (não no que é meu).
drop policy if exists note_reads_insert on public.note_reads;
create policy note_reads_insert on public.note_reads
  for insert to authenticated
  with check (user_id = auth.uid() and public.shares_note_with_me(note_id));

drop policy if exists note_reads_update on public.note_reads;
create policy note_reads_update on public.note_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime: o mural do dono se atualiza sozinho quando alguém vê (a RLS continua valendo).
alter publication supabase_realtime add table public.note_reads;

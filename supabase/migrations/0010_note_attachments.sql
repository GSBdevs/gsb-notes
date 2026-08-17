-- Anexos em lembretes (Fase 4). Metadados numa tabela + bytes no Storage (bucket privado).
-- Path do arquivo = "<note_id>/<uuid>" — assim a RLS do Storage checa "posso ver a nota?".
-- Rode no SQL Editor DEPOIS de 0001→0009.

-- ─────────────────────────────────────────────────────────────────────────────
-- Metadados
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.note_attachments (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references public.notes(id)    on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  path        text not null,               -- caminho no bucket: <note_id>/<uuid>
  name        text not null,               -- nome original do arquivo
  size        bigint not null default 0,
  mime        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists note_attachments_note_idx on public.note_attachments (note_id, created_at);

alter table public.note_attachments enable row level security;

-- Ver/enviar = quem enxerga a nota (reusa can_see_note da 0009); apagar = uploader ou dono da nota.
drop policy if exists note_attachments_select on public.note_attachments;
create policy note_attachments_select on public.note_attachments
  for select to authenticated using (public.can_see_note(note_id));

drop policy if exists note_attachments_insert on public.note_attachments;
create policy note_attachments_insert on public.note_attachments
  for insert to authenticated
  with check (uploader_id = auth.uid() and public.can_see_note(note_id));

drop policy if exists note_attachments_delete on public.note_attachments;
create policy note_attachments_delete on public.note_attachments
  for delete to authenticated
  using (uploader_id = auth.uid() or public.owns_note(note_id));

alter publication supabase_realtime add table public.note_attachments;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: bucket privado + políticas nos objetos (por prefixo <note_id>)
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('note-attachments', 'note-attachments', false)
on conflict (id) do nothing;

-- storage.objects já vem com RLS ligada no Supabase — só criamos as políticas. Se alguma
-- reclamar de "must be owner", crie-as pela UI: Storage → Policies (mesma condição).
-- (storage.foldername(name))[1] = a primeira pasta do path = o note_id.
drop policy if exists sb_notas_attach_read on storage.objects;
create policy sb_notas_attach_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'note-attachments'
    and public.can_see_note(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists sb_notas_attach_insert on storage.objects;
create policy sb_notas_attach_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'note-attachments'
    and public.can_see_note(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists sb_notas_attach_delete on storage.objects;
create policy sb_notas_attach_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'note-attachments'
    and (owner = auth.uid() or public.owns_note(((storage.foldername(name))[1])::uuid))
  );

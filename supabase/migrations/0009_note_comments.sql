-- Comentários em lembretes (Fase 4). Quem enxerga a nota (dono, compartilhado 1:1 ou membro do
-- quadro) pode ler e comentar; apagar = o autor do comentário OU o dono da nota. Rode no SQL
-- Editor DEPOIS de 0001→0008.

-- Helper: "posso ver esta nota?" — espelha a política notes_select. SECURITY DEFINER p/ evitar
-- recursão de RLS (reusa shares_note_with_me / is_workspace_member das migrações anteriores).
create or replace function public.can_see_note(nid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.notes n
    where n.id = nid
      and (
        n.owner_id = auth.uid()
        or public.shares_note_with_me(nid)
        or (n.workspace_id is not null and public.is_workspace_member(n.workspace_id))
      )
  );
$$;

create table if not exists public.note_comments (
  id         uuid primary key default gen_random_uuid(),
  note_id    uuid not null references public.notes(id)    on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists note_comments_note_idx on public.note_comments (note_id, created_at);

alter table public.note_comments enable row level security;

drop policy if exists note_comments_select on public.note_comments;
create policy note_comments_select on public.note_comments
  for select to authenticated using (public.can_see_note(note_id));

drop policy if exists note_comments_insert on public.note_comments;
create policy note_comments_insert on public.note_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.can_see_note(note_id));

drop policy if exists note_comments_delete on public.note_comments;
create policy note_comments_delete on public.note_comments
  for delete to authenticated
  using (author_id = auth.uid() or public.owns_note(note_id));

-- Realtime: os comentários aparecem ao vivo para quem está com o lembrete aberto.
alter publication supabase_realtime add table public.note_comments;

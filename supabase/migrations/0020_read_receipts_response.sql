-- Recibos por-destinatário do DISPARO (backlog #1, dobrado no auto-snooze). Estende o
-- "visto por" (0005) para registrar a RESPOSTA de cada destinatário a um disparo:
--   response = null   → só viu (o overlay apareceu na tela dele)
--            = 'done'  → marcou como concluído (acknowledgment pessoal; NÃO arquiva a nota)
--            = 'snoozed'→ adiou
-- Quem VÊ os recibos: o dono da nota e os ADMINS do quadro a que a nota pertence.
-- Rode no SQL Editor DEPOIS de 0019.

-- 1) Colunas novas em note_reads (a linha por (note_id, user_id) já existe da 0005).
alter table public.note_reads
  add column if not exists response text
    check (response in ('done', 'snoozed')),
  add column if not exists responded_at timestamptz;

-- 2) Helpers (SECURITY DEFINER — evitam recursão de RLS).

-- Sou admin/dono do quadro a que a nota pertence? (para VER os recibos dela.)
create or replace function public.note_workspace_admin(nid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.notes n
    where n.id = nid
      and n.workspace_id is not null
      and public.is_workspace_admin(n.workspace_id)
  );
$$;

-- A nota é destinada a mim (não sou o dono, mas recebo por share 1:1 ou por ser membro do quadro)?
-- Habilita gravar o meu recibo (visto/resposta) — inclui membros de quadro, que a 0005 não cobria.
create or replace function public.note_targets_me(nid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.notes n
    where n.id = nid
      and n.owner_id <> auth.uid()
      and (
        public.shares_note_with_me(nid)
        or (
          n.workspace_id is not null
          and exists (
            select 1 from public.workspace_members m
            where m.workspace_id = n.workspace_id and m.user_id = auth.uid()
          )
        )
      )
  );
$$;

-- 3) RLS: VER = próprio leitor, dono da nota, OU admin do quadro. (Redeclara a 0005 + admin.)
drop policy if exists note_reads_select on public.note_reads;
create policy note_reads_select on public.note_reads
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.owns_note(note_id)
    or public.note_workspace_admin(note_id)
  );

-- GRAVAR o próprio recibo: share 1:1 comigo OU membro do quadro (amplia a 0005, que só via shares).
drop policy if exists note_reads_insert on public.note_reads;
create policy note_reads_insert on public.note_reads
  for insert to authenticated
  with check (user_id = auth.uid() and public.note_targets_me(note_id));

-- ATUALIZAR só o meu próprio recibo (inclui setar response/responded_at). Mantém a 0005.
drop policy if exists note_reads_update on public.note_reads;
create policy note_reads_update on public.note_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

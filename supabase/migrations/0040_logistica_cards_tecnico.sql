-- 0040 — Logística: cards extras, Viana e visão restrita do técnico (doc 21 §12).
--
-- 1. CARDS EXTRAS ("boards"): além das 3 cidades fixas, Master/Admin/Suporte criam cards só com um
--    NOME, com UMA rota (sem Pré-Rota). Quem criou pode excluir (o card some dos Ativos e a rota ativa
--    dele é apagada; as rotas já concluídas continuam no histórico). Ao concluir a rota de um card, ela
--    vai para Concluídos com os ✗ registrados e o card fica livre — sem virada/Pré-Rota.
-- 2. "Vila Velha/Cariacica" passa a se chamar "Vila Velha/Cariacica/Viana" (só o rótulo; a chave
--    `vv_cariacica` continua a mesma).
-- 3. TÉCNICO (que não é Master/Admin/Suporte) vê só a Rota do dia atribuída a ELE — não vê Pré-Rotas
--    nem rotas de outros. O histórico de concluídos continua global para todos.
-- Rode DEPOIS de 0039. Idempotente.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Cards extras
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.logistics_boards (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.logistics_boards enable row level security;

-- Todos leem (o nome aparece nos Ativos e no histórico). Escrita só pelas RPCs.
drop policy if exists logistics_boards_select on public.logistics_boards;
create policy logistics_boards_select on public.logistics_boards
  for select to authenticated using (true);

-- A rota pertence a UMA cidade fixa OU a UM card extra.
alter table public.logistics_routes alter column city drop not null;
alter table public.logistics_routes
  add column if not exists board_id uuid references public.logistics_boards(id) on delete cascade;

alter table public.logistics_routes drop constraint if exists logistics_routes_city_or_board;
alter table public.logistics_routes
  add constraint logistics_routes_city_or_board check ((city is null) <> (board_id is null));

-- Card extra não tem Pré-Rota.
alter table public.logistics_routes drop constraint if exists logistics_routes_board_no_pre;
alter table public.logistics_routes
  add constraint logistics_routes_board_no_pre check (board_id is null or slot <> 'pre_rota');

-- Uma rota ativa por card.
create unique index if not exists logistics_routes_board_uniq
  on public.logistics_routes (board_id) where slot = 'rota' and board_id is not null;

-- Cria um card extra (só gerente).
create or replace function public.logistics_create_board(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_logistics_manager() then
    raise exception 'Só Master, Admin ou Suporte criam cards';
  end if;
  insert into public.logistics_boards (name, created_by) values (trim(p_name), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Exclui (arquiva) um card: só quem criou. A rota ATIVA do card é apagada; o histórico fica.
create or replace function public.logistics_delete_board(p_board uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.logistics_boards where id = p_board and created_by = auth.uid()) then
    raise exception 'Só quem criou o card pode excluí-lo';
  end if;
  delete from public.notes
   where id in (select note_id from public.logistics_routes where board_id = p_board and slot = 'rota');
  update public.logistics_boards set archived_at = now() where id = p_board;
end;
$$;

-- Criar rota: agora numa cidade (rota/pré-rota) OU num card (só rota). Assinatura nova.
drop function if exists public.logistics_create_route(text, text, text, text, text[], uuid);
create or replace function public.logistics_create_route(
  p_city text, p_board uuid, p_slot text, p_title text, p_body text, p_items text[], p_technician uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_logistics_manager() then
    raise exception 'Só Master, Admin ou Suporte criam rotas';
  end if;
  if (p_city is null) = (p_board is null) then
    raise exception 'Informe a cidade OU o card';
  end if;
  if p_slot not in ('rota', 'pre_rota') or (p_board is not null and p_slot <> 'rota') then
    raise exception 'Vaga inválida: %', p_slot;
  end if;
  if p_board is not null and not exists (
    select 1 from public.logistics_boards where id = p_board and archived_at is null
  ) then
    raise exception 'Card não encontrado';
  end if;
  if exists (
    select 1 from public.logistics_routes
     where slot = p_slot
       and ((p_city is not null and city = p_city) or (p_board is not null and board_id = p_board))
  ) then
    raise exception 'Já existe uma % aqui', case p_slot when 'rota' then 'Rota do dia' else 'Pré-Rota' end;
  end if;
  if p_technician is not null
     and not exists (select 1 from public.logistics_technicians where user_id = p_technician) then
    raise exception 'O usuário escolhido não é técnico';
  end if;

  insert into public.notes (owner_id, title, body, kind, status)
  values (auth.uid(), coalesce(nullif(trim(p_title), ''), 'Rota'), coalesce(p_body, ''), 'route', 'active')
  returning id into v_id;
  insert into public.logistics_routes (note_id, city, board_id, slot, technician_id)
  values (v_id, p_city, p_board, p_slot, p_technician);
  insert into public.note_checklist_items (note_id, position, text, done)
  select v_id, (o.i - 1)::int, o.t, false
    from unnest(coalesce(p_items, '{}'::text[])) with ordinality as o(t, i)
   where trim(o.t) <> '';
  return v_id;
end;
$$;

revoke all on function public.logistics_create_board(text) from public;
revoke all on function public.logistics_delete_board(uuid) from public;
revoke all on function public.logistics_create_route(text, uuid, text, text, text, text[], uuid) from public;
grant execute on function public.logistics_create_board(text) to authenticated;
grant execute on function public.logistics_delete_board(uuid) to authenticated;
grant execute on function public.logistics_create_route(text, uuid, text, text, text, text[], uuid) to authenticated;

-- Ciclo do dia (0038) + card extra: a rota do card só vai para Concluídos (✗ ficam no histórico).
create or replace function public.logistics_day_cycle()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_city text; v_board uuid; v_slot text; v_pre uuid; v_failed int; v_base int;
begin
  select city, board_id, slot into v_city, v_board, v_slot from public.logistics_routes where note_id = new.id;
  if v_slot is distinct from 'rota' then
    return null;
  end if;

  if v_board is not null then
    update public.logistics_routes set slot = 'concluida' where note_id = new.id;
    return null;
  end if;

  select count(*) into v_failed
    from public.note_checklist_items where note_id = new.id and done and failed;

  select note_id into v_pre from public.logistics_routes where city = v_city and slot = 'pre_rota';

  if v_failed > 0 then
    if v_pre is null then
      insert into public.notes (owner_id, title, kind, status)
      values (new.owner_id, 'Pré-Rota — ' || public.logistics_city_label(v_city), 'route', 'active')
      returning id into v_pre;
      insert into public.logistics_routes (note_id, city, slot) values (v_pre, v_city, 'pre_rota');
    end if;
    select coalesce(max(position), -1) + 1 into v_base
      from public.note_checklist_items where note_id = v_pre;
    insert into public.note_checklist_items (note_id, position, text, done)
    select v_pre, v_base + (row_number() over (order by position))::int - 1, text, false
      from public.note_checklist_items
     where note_id = new.id and done and failed;
  end if;

  update public.logistics_routes set slot = 'concluida' where note_id = new.id;

  if v_pre is not null then
    update public.logistics_routes set slot = 'rota' where note_id = v_pre;
    update public.notes set updated_at = now() where id = v_pre;
  end if;
  return null;
end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Viana
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.logistics_city_label(p_city text)
returns text language sql immutable as $$
  select case p_city
    when 'serra' then 'Serra'
    when 'vitoria' then 'Vitória'
    when 'vv_cariacica' then 'Vila Velha/Cariacica/Viana'
    else p_city end;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Técnico vê só a Rota do dia dele (concluídos seguem globais)
-- ═════════════════════════════════════════════════════════════════════════════
-- Pode ver ESTA rota? Gerente: tudo. Técnico (não-gerente): a Rota do dia atribuída a ele + o
-- histórico (concluídas). Demais usuários: tudo (só leitura).
create or replace function public.can_view_route(nid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select case
    when public.is_logistics_manager() then true
    when public.is_logistics_technician() then exists (
      select 1 from public.logistics_routes lr
       where lr.note_id = nid
         and (lr.slot = 'concluida' or (lr.slot = 'rota' and lr.technician_id = auth.uid()))
    )
    else true
  end;
$$;

drop policy if exists notes_select_route on public.notes;
create policy notes_select_route on public.notes
  for select to authenticated
  using (kind = 'route' and public.can_view_route(id));

drop policy if exists logistics_routes_select on public.logistics_routes;
create policy logistics_routes_select on public.logistics_routes
  for select to authenticated using (public.can_view_route(note_id));

-- can_see_note (checklist/anexos): mesmo corpo da 0038, com a regra por rota.
create or replace function public.can_see_note(nid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.notes n
    where n.id = nid
      and (
        n.owner_id = auth.uid()
        or public.shares_note_with_me(nid)
        or (n.workspace_id is not null and public.is_workspace_member(n.workspace_id))
        or (n.kind = 'route' and public.can_view_route(nid))
      )
  );
$$;

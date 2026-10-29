-- 0038 — Aba "Logística": rotas por cidade (escopo em internal/docs/21).
--
-- Uma ROTA é uma `notes` com kind = 'route' (reusa checklist ✓/✗, anotações, anexos, completed_at e
-- realtime das Tarefas). Os dados de logística ficam em `logistics_routes` (1:1 com a nota):
-- cidade, vaga (rota do dia / pré-rota / concluída) e técnico. Cada cidade tem no máximo UMA Rota do
-- dia e UMA Pré-Rota ativas.
--
-- Papéis: Master, Admin e o novo "Suporte" GERENCIAM (criam rotas, trocam técnico, definem técnicos).
-- Técnico (lista `logistics_technicians`) edita e marca itens só da rota atribuída a ele. Os demais só
-- veem. Ciclo do dia (automático): ao concluir a Rota do dia, os itens ✗ "não feito" vão para a
-- Pré-Rota da cidade, a rota vai para Concluídos e a Pré-Rota vira a nova Rota do dia.
--
-- FASE DE TESTE: `can_view_routes()` libera a leitura só para master/admin/suporte/técnicos. Para
-- LIBERAR para todos, troque o corpo dela por `select true` (ver o fim do arquivo). Rode DEPOIS de
-- 0037. Idempotente.

-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Papel global "suporte"
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles
  add constraint user_roles_role_check check (role in ('master', 'admin', 'suporte', 'member'));

-- O master define admin | suporte | member (o master continua semeado por e-mail, 0024).
create or replace function public.admin_set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_master() then
    raise exception 'apenas o master pode definir papéis';
  end if;
  if new_role not in ('admin', 'suporte', 'member') then
    raise exception 'papel inválido: %', new_role;
  end if;
  insert into public.user_roles (user_id, role, updated_at)
  values (target, new_role, now())
  on conflict (user_id) do update set role = excluded.role, updated_at = now();
end;
$$;

-- Gerente de logística = master, admin ou suporte.
create or replace function public.is_logistics_manager()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.user_roles
     where user_id = auth.uid() and role in ('master', 'admin', 'suporte')
  );
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Técnicos
-- ═════════════════════════════════════════════════════════════════════════════
create table if not exists public.logistics_technicians (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.logistics_technicians enable row level security;

-- Todos leem (o nome do técnico aparece na rota). Escrita só pela RPC abaixo.
drop policy if exists logistics_technicians_select on public.logistics_technicians;
create policy logistics_technicians_select on public.logistics_technicians
  for select to authenticated using (true);

create or replace function public.is_logistics_technician()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.logistics_technicians where user_id = auth.uid());
$$;

-- Quem pode VER as rotas. FASE DE TESTE: gerentes + técnicos. Liberação: `select true`.
create or replace function public.can_view_routes()
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_logistics_manager() or public.is_logistics_technician();
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Rotas
-- ═════════════════════════════════════════════════════════════════════════════
alter table public.notes drop constraint if exists notes_kind_check;
alter table public.notes
  add constraint notes_kind_check check (kind in ('reminder', 'doc', 'block', 'call', 'route'));

create table if not exists public.logistics_routes (
  note_id       uuid primary key references public.notes(id) on delete cascade,
  city          text not null check (city in ('serra', 'vitoria', 'vv_cariacica')),
  slot          text not null check (slot in ('rota', 'pre_rota', 'concluida')),
  technician_id uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Uma Rota do dia e uma Pré-Rota ATIVAS por cidade.
create unique index if not exists logistics_routes_slot_uniq
  on public.logistics_routes (city, slot) where slot in ('rota', 'pre_rota');
create index if not exists logistics_routes_tech_idx on public.logistics_routes (technician_id);

drop trigger if exists logistics_routes_updated_at on public.logistics_routes;
create trigger logistics_routes_updated_at
  before update on public.logistics_routes
  for each row execute function public.set_updated_at();

alter table public.logistics_routes enable row level security;

-- Leitura: quem pode ver rotas. Escrita: SÓ pelas RPCs (sem policy de insert/update/delete).
drop policy if exists logistics_routes_select on public.logistics_routes;
create policy logistics_routes_select on public.logistics_routes
  for select to authenticated using (public.can_view_routes());

-- ═════════════════════════════════════════════════════════════════════════════
-- 4. RLS das notas (ADITIVA — as regras das outras notas não mudam)
-- ═════════════════════════════════════════════════════════════════════════════
-- Ver: além de dono/compartilhado (0028), quem pode ver rotas vê as notas kind 'route'.
drop policy if exists notes_select_route on public.notes;
create policy notes_select_route on public.notes
  for select to authenticated
  using (kind = 'route' and public.can_view_routes());

-- can_see_note (checklist/anexos/comentários): mesmo corpo da 0009 + o ramo das rotas.
create or replace function public.can_see_note(nid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.notes n
    where n.id = nid
      and (
        n.owner_id = auth.uid()
        or public.shares_note_with_me(nid)
        or (n.workspace_id is not null and public.is_workspace_member(n.workspace_id))
        or (n.kind = 'route' and public.can_view_routes())
      )
  );
$$;

-- can_edit_note: mesmo corpo da 0001 + rota editável por gerente ou pelo técnico DAQUELA rota.
create or replace function public.can_edit_note(nid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.notes where id = nid and owner_id = auth.uid())
      or exists (
        select 1 from public.note_shares
        where note_id = nid and shared_with = auth.uid() and permission = 'edit'
      )
      or exists (
        select 1 from public.logistics_routes lr
         where lr.note_id = nid
           and (public.is_logistics_manager() or lr.technician_id = auth.uid())
      );
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Marcar item: em ROTA exige poder EDITAR (não só ver) e só na Rota do dia.
-- Mesmo corpo da 0036 + as regras de rota.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.resolve_checklist_item(p_item uuid, p_done boolean, p_failed boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_note uuid; v_owner uuid; v_done_by uuid; v_was_done boolean; v_kind text; v_slot text;
  v_total int; v_done int;
begin
  select ci.note_id, ci.done_by, ci.done, n.owner_id, n.kind
    into v_note, v_done_by, v_was_done, v_owner, v_kind
    from public.note_checklist_items ci
    join public.notes n on n.id = ci.note_id
   where ci.id = p_item;
  if v_note is null then
    raise exception 'Item não encontrado';
  end if;
  if not public.can_see_note(v_note) then
    raise exception 'Sem permissão para este item';
  end if;

  if v_kind = 'route' then
    if not public.can_edit_note(v_note) then
      raise exception 'Só o técnico da rota ou o Suporte/Admin podem marcar itens';
    end if;
    select slot into v_slot from public.logistics_routes where note_id = v_note;
    if v_slot is distinct from 'rota' then
      raise exception 'Só a Rota do dia pode ter itens marcados';
    end if;
  end if;

  -- Reabrir/trocar a resolução de alguém: só quem resolveu ou o autor (em rota, também o gerente).
  if v_was_done and v_done_by is not null
     and auth.uid() <> v_done_by and auth.uid() <> v_owner
     and not (v_kind = 'route' and public.is_logistics_manager()) then
    raise exception 'Só quem concluiu o item ou o autor da tarefa pode alterá-lo';
  end if;

  update public.note_checklist_items
     set done    = p_done,
         failed  = p_done and coalesce(p_failed, false),
         done_by = case when p_done then auth.uid() else null end,
         done_at = case when p_done then now() else null end
   where id = p_item;

  select count(*), count(*) filter (where done) into v_total, v_done
    from public.note_checklist_items where note_id = v_note;

  if v_total > 0 and v_done = v_total then
    update public.notes set status = 'archived' where id = v_note and status <> 'archived';
  elsif v_total > 0 and v_done < v_total then
    update public.notes set status = 'active' where id = v_note and status = 'archived';
  end if;
end;
$$;

grant execute on function public.resolve_checklist_item(uuid, boolean, boolean) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Ciclo do dia + travas de status
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.logistics_city_label(p_city text)
returns text language sql immutable as $$
  select case p_city
    when 'serra' then 'Serra'
    when 'vitoria' then 'Vitória'
    when 'vv_cariacica' then 'Vila Velha/Cariacica'
    else p_city end;
$$;

-- ANTES de mudar o status de uma rota: Pré-Rota não conclui (só depois de virar Rota do dia) e rota
-- concluída não reabre (desfaria a virada do dia).
create or replace function public.logistics_guard_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_slot text;
begin
  select slot into v_slot from public.logistics_routes where note_id = new.id;
  if v_slot is null then
    return new;
  end if;
  if new.status = 'archived' and old.status <> 'archived' and v_slot = 'pre_rota' then
    raise exception 'A Pré-Rota só pode ser concluída depois de virar Rota do dia';
  end if;
  if old.status = 'archived' and new.status <> 'archived' and v_slot = 'concluida' then
    raise exception 'Rota concluída não pode ser reaberta';
  end if;
  return new;
end;
$$;

drop trigger if exists notes_logistics_guard on public.notes;
create trigger notes_logistics_guard
  before update of status on public.notes
  for each row when (new.kind = 'route')
  execute function public.logistics_guard_status();

-- DEPOIS de a Rota do dia ser concluída: não feitos → Pré-Rota; rota → Concluídos; Pré-Rota → Rota do dia.
create or replace function public.logistics_day_cycle()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_city text; v_slot text; v_pre uuid; v_failed int; v_base int;
begin
  select city, slot into v_city, v_slot from public.logistics_routes where note_id = new.id;
  if v_slot is distinct from 'rota' then
    return null;
  end if;

  select count(*) into v_failed
    from public.note_checklist_items where note_id = new.id and done and failed;

  select note_id into v_pre from public.logistics_routes where city = v_city and slot = 'pre_rota';

  -- 1. Itens ✗ → Pré-Rota (cria a Pré-Rota se a vaga estiver vazia).
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

  -- 2. A rota concluída sai da vaga (antes de promover, por causa do índice único).
  update public.logistics_routes set slot = 'concluida' where note_id = new.id;

  -- 3. Pré-Rota → Rota do dia (mantém o técnico que já estava definido nela).
  if v_pre is not null then
    update public.logistics_routes set slot = 'rota' where note_id = v_pre;
    update public.notes set updated_at = now() where id = v_pre; -- avisa o realtime
  end if;
  return null;
end;
$$;

drop trigger if exists notes_logistics_cycle on public.notes;
create trigger notes_logistics_cycle
  after update of status on public.notes
  for each row when (new.kind = 'route' and new.status = 'archived' and old.status <> 'archived')
  execute function public.logistics_day_cycle();

-- ═════════════════════════════════════════════════════════════════════════════
-- 7. RPCs (gerentes)
-- ═════════════════════════════════════════════════════════════════════════════
-- Cria a rota numa vaga livre (nota + logística + itens, numa transação).
create or replace function public.logistics_create_route(
  p_city text, p_slot text, p_title text, p_body text, p_items text[], p_technician uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_logistics_manager() then
    raise exception 'Só Master, Admin ou Suporte criam rotas';
  end if;
  if p_slot not in ('rota', 'pre_rota') then
    raise exception 'Vaga inválida: %', p_slot;
  end if;
  if exists (select 1 from public.logistics_routes where city = p_city and slot = p_slot) then
    raise exception 'Já existe uma % para esta cidade', case p_slot when 'rota' then 'Rota do dia' else 'Pré-Rota' end;
  end if;
  if p_technician is not null
     and not exists (select 1 from public.logistics_technicians where user_id = p_technician) then
    raise exception 'O usuário escolhido não é técnico';
  end if;

  insert into public.notes (owner_id, title, body, kind, status)
  values (auth.uid(), coalesce(nullif(trim(p_title), ''), 'Rota'), coalesce(p_body, ''), 'route', 'active')
  returning id into v_id;
  insert into public.logistics_routes (note_id, city, slot, technician_id)
  values (v_id, p_city, p_slot, p_technician);
  insert into public.note_checklist_items (note_id, position, text, done)
  select v_id, (o.i - 1)::int, o.t, false
    from unnest(coalesce(p_items, '{}'::text[])) with ordinality as o(t, i)
   where trim(o.t) <> '';
  return v_id;
end;
$$;

-- Define (ou limpa) o técnico de uma rota.
create or replace function public.logistics_set_route_technician(p_note uuid, p_technician uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_logistics_manager() then
    raise exception 'Só Master, Admin ou Suporte trocam o técnico';
  end if;
  if p_technician is not null
     and not exists (select 1 from public.logistics_technicians where user_id = p_technician) then
    raise exception 'O usuário escolhido não é técnico';
  end if;
  update public.logistics_routes set technician_id = p_technician where note_id = p_note;
  update public.notes set updated_at = now() where id = p_note; -- avisa o realtime
end;
$$;

-- Apaga uma rota (só gerente).
create or replace function public.logistics_delete_route(p_note uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_logistics_manager() then
    raise exception 'Só Master, Admin ou Suporte apagam rotas';
  end if;
  delete from public.notes where id = p_note and kind = 'route';
end;
$$;

-- Liga/desliga "é técnico" de um usuário.
create or replace function public.logistics_set_technician(p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_logistics_manager() then
    raise exception 'Só Master, Admin ou Suporte definem técnicos';
  end if;
  if p_on then
    insert into public.logistics_technicians (user_id, added_by) values (p_user, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from public.logistics_technicians where user_id = p_user;
  end if;
end;
$$;

-- Todos os usuários (para o gerente escolher quem é técnico). Só gerente recebe linhas.
create or replace function public.logistics_list_users()
returns table (user_id uuid, display_name text, avatar_color text, avatar_url text, is_technician boolean)
language sql security definer stable set search_path = public as $$
  select p.id, p.display_name, p.avatar_color, p.avatar_url,
         exists (select 1 from public.logistics_technicians t where t.user_id = p.id)
    from public.profiles p
   where public.is_logistics_manager()
   order by p.display_name;
$$;

revoke all on function public.logistics_create_route(text, text, text, text, text[], uuid) from public;
revoke all on function public.logistics_set_route_technician(uuid, uuid) from public;
revoke all on function public.logistics_delete_route(uuid) from public;
revoke all on function public.logistics_set_technician(uuid, boolean) from public;
revoke all on function public.logistics_list_users() from public;
grant execute on function public.logistics_create_route(text, text, text, text, text[], uuid) to authenticated;
grant execute on function public.logistics_set_route_technician(uuid, uuid) to authenticated;
grant execute on function public.logistics_delete_route(uuid) to authenticated;
grant execute on function public.logistics_set_technician(uuid, boolean) to authenticated;
grant execute on function public.logistics_list_users() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- LIBERAÇÃO PARA TODOS (quando o dono aprovar os testes) — rode só isto:
--
--   create or replace function public.can_view_routes()
--   returns boolean language sql security definer stable set search_path = public as $$
--     select true;
--   $$;
-- ─────────────────────────────────────────────────────────────────────────────

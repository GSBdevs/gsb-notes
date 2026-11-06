-- Módulo "Rotas" (logística de técnicos de impressora) — v1, ferramenta de teste (master-only na UI).
-- Escopo em internal/docs/19. Um CHAMADO é uma `notes` com kind = 'call' (reusa RLS, shares,
-- comentários, anexos, checklist 0016 + auto-conclusão 0034, completed_at 0031). Os dados próprios
-- do chamado (endereço, coordenadas, técnico, dia, ordem na rota, campos de MPS) vivem em
-- `service_calls`, 1:1 com a nota. A "rota" não tem tabela: é técnico + dia ordenados por
-- route_position. Rode DEPOIS de 0034.
--
-- Obs.: a auto-limpeza de 30 dias (0026) filtra kind in ('reminder','doc') — chamados concluídos
-- NÃO são apagados (histórico de atendimento).

-- 1. Novo kind 'call' (estende o CHECK da 0018).
alter table public.notes drop constraint if exists notes_kind_check;
alter table public.notes add constraint notes_kind_check check (kind in ('reminder', 'doc', 'block', 'call'));

-- 2. Dados do chamado.
create table if not exists public.service_calls (
  note_id        uuid primary key references public.notes(id) on delete cascade,
  customer       text not null default '',
  address        text not null default '',
  cep            text,
  lat            double precision,
  lon            double precision,
  geo_source     text check (geo_source in ('nominatim', 'manual')),
  call_type      text not null default 'corretiva'
                 check (call_type in ('corretiva', 'preventiva', 'instalacao', 'entrega_suprimento', 'leitura', 'outro')),
  scheduled_date date,
  technician_id  uuid references public.profiles(id) on delete set null,
  route_position int  not null default 0,
  est_minutes    int  not null default 45 check (est_minutes between 0 and 1440),
  equipment      text,
  serial_number  text,
  meter_bw       int,
  meter_color    int,
  toner          jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists service_calls_route_idx
  on public.service_calls (technician_id, scheduled_date, route_position);
create index if not exists service_calls_date_idx on public.service_calls (scheduled_date);

drop trigger if exists service_calls_updated_at on public.service_calls;
create trigger service_calls_updated_at
  before update on public.service_calls
  for each row execute function public.set_updated_at();

-- 3. RLS: quem vê a nota vê o chamado; quem edita a nota edita o chamado.
alter table public.service_calls enable row level security;

drop policy if exists service_calls_select on public.service_calls;
create policy service_calls_select on public.service_calls
  for select to authenticated using (public.can_see_note(note_id));

drop policy if exists service_calls_insert on public.service_calls;
create policy service_calls_insert on public.service_calls
  for insert to authenticated with check (public.can_edit_note(note_id));

drop policy if exists service_calls_update on public.service_calls;
create policy service_calls_update on public.service_calls
  for update to authenticated using (public.can_edit_note(note_id)) with check (public.can_edit_note(note_id));

drop policy if exists service_calls_delete on public.service_calls;
create policy service_calls_delete on public.service_calls
  for delete to authenticated using (public.can_edit_note(note_id));

-- 4. Reordenar uma rota num lote só: route_position = índice no array. SECURITY INVOKER — a policy
-- de update (can_edit_note) continua valendo para cada linha; ids sem permissão são ignorados.
create or replace function public.reorder_route(p_ids uuid[])
returns void language sql security invoker set search_path = public as $$
  update public.service_calls sc
     set route_position = o.pos - 1
    from unnest(p_ids) with ordinality as o(id, pos)
   where sc.note_id = o.id;
$$;

grant execute on function public.reorder_route(uuid[]) to authenticated;

-- 5. Tempo real: em vez de publicar service_calls (o cliente teria de assinar uma tabela a mais),
-- toda mudança no chamado "toca" a nota (updated_at) — o canal de `notes`, que o app já assina,
-- avisa e a tela invalida o cache. SECURITY DEFINER para valer também para quem só marcou item.
create or replace function public.touch_note_from_call()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.notes set updated_at = now()
   where id = coalesce(new.note_id, old.note_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists service_calls_touch_note on public.service_calls;
create trigger service_calls_touch_note
  after insert or update on public.service_calls
  for each row execute function public.touch_note_from_call();

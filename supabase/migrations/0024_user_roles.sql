-- Hierarquia GLOBAL de usuários (papel do app, diferente do RBAC por quadro da 0019).
-- Papéis: master | admin | member. O papel é OCULTO para o usuário comum (a UI não mostra);
-- só o MASTER vê e atribui. Ver internal/docs/12 §6. Rode DEPOIS de 0023.
--
--   master → superusuário: vê os dados de todos, define papéis, troca a senha de qualquer um
--            (via Edge Function admin-reset-password). Semeado por e-mail abaixo.
--   admin  → papel intermediário (reservado; sem poderes especiais de dados por ora).
--   member → padrão (todo usuário sem papel definido).

create table if not exists public.user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role    text not null default 'member' check (role in ('master', 'admin', 'member')),
  updated_at timestamptz not null default now()
);

-- Semeia o MASTER pelo e-mail (idempotente). Troque o e-mail aqui se mudar o dono master.
insert into public.user_roles (user_id, role)
select u.id, 'master'
  from auth.users u
 where lower(u.email) = 'passamaniarthur@gmail.com'
on conflict (user_id) do update set role = 'master', updated_at = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers (SECURITY DEFINER — leem user_roles sem reaplicar RLS / sem recursão).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.app_role()
returns text language sql security definer stable set search_path = public as $$
  select coalesce((select role from public.user_roles where user_id = auth.uid()), 'member');
$$;

create or replace function public.is_master()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'master');
$$;

create or replace function public.is_app_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('master', 'admin'));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS de user_roles: cada um LÊ só o próprio papel (a UI usa p/ saber se é master, mas não exibe);
-- o MASTER lê todos. Só o MASTER escreve (via RPC abaixo — o insert/update direto fica bloqueado).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.user_roles enable row level security;

drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_master());

-- Sem policy de insert/update/delete para 'authenticated' → escrita só pelo MASTER via RPC (definer)
-- ou pela service_role (Edge Function). Isso impede escalonamento de privilégio pelo cliente.

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs de administração (SECURITY DEFINER + checagem is_master() DENTRO da função).
-- ─────────────────────────────────────────────────────────────────────────────

-- Lista todos os usuários (id, nome, e-mail, papel) — só o master recebe linhas.
create or replace function public.admin_list_users()
returns table (user_id uuid, display_name text, email text, avatar_color text, avatar_url text, role text)
language sql security definer stable set search_path = public as $$
  select p.id, p.display_name, u.email, p.avatar_color, p.avatar_url,
         coalesce(r.role, 'member') as role
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.user_roles r on r.user_id = p.id
   where public.is_master()
   order by p.display_name;
$$;

-- Define o papel de um usuário — só admin/member (o master é semeado por e-mail, não pela UI).
create or replace function public.admin_set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_master() then
    raise exception 'apenas o master pode definir papéis';
  end if;
  if new_role not in ('admin', 'member') then
    raise exception 'papel inválido: %', new_role;
  end if;
  insert into public.user_roles (user_id, role, updated_at)
  values (target, new_role, now())
  on conflict (user_id) do update set role = excluded.role, updated_at = now();
end;
$$;

-- Retorna as notas de um usuário (para o master visualizar) — só o master recebe linhas.
create or replace function public.admin_get_user_notes(target uuid)
returns table (id uuid, kind text, title text, status text, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select n.id, coalesce(n.kind, 'reminder') as kind, n.title, n.status, n.created_at
    from public.notes n
   where public.is_master() and n.owner_id = target
   order by n.created_at desc;
$$;

revoke all on function public.admin_list_users() from public;
revoke all on function public.admin_set_role(uuid, text) from public;
revoke all on function public.admin_get_user_notes(uuid) from public;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
grant execute on function public.admin_get_user_notes(uuid) to authenticated;

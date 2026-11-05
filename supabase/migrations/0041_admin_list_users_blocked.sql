-- ─────────────────────────────────────────────────────────────────────────────
-- 0041 — Login restrito (doc 22): o painel do master mostra quem está bloqueado.
-- O bloqueio em si é feito pela Edge Function admin-users (ban_duration do Supabase Auth).
-- Muda o retorno de admin_list_users, por isso o drop antes do create.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.admin_list_users();

create function public.admin_list_users()
returns table (
  user_id uuid,
  display_name text,
  email text,
  avatar_color text,
  avatar_url text,
  role text,
  blocked boolean
)
language sql security definer stable set search_path = public as $$
  select p.id, p.display_name, u.email, p.avatar_color, p.avatar_url,
         coalesce(r.role, 'member') as role,
         coalesce(u.banned_until > now(), false) as blocked
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.user_roles r on r.user_id = p.id
   where public.is_master()
   order by p.display_name;
$$;

revoke all on function public.admin_list_users() from public;
grant execute on function public.admin_list_users() to authenticated;

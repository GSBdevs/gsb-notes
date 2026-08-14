-- Lookup de perfil por e-mail para o compartilhamento (RF-07).
-- SECURITY DEFINER: acessa auth.users (onde o e-mail vive) sem expô-lo via RLS.
-- Match EXATO (case-insensitive) — não permite enumerar e-mails. Retorna só id/nome/cor.
create or replace function public.find_profile_by_email(p_email text)
returns table (id uuid, display_name text, avatar_color text)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.display_name, p.avatar_color
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
    and u.id <> auth.uid()          -- não retorna você mesmo
  limit 1;
$$;

grant execute on function public.find_profile_by_email(text) to authenticated;

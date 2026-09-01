-- Foto de perfil (Fase 5). O bucket público `avatars` guarda a foto de cada usuário em
-- `{uid}/avatar`. A coluna `profiles.avatar_url` já existe desde a 0001 — aqui só criamos o
-- bucket e as policies do Storage. Bucket público = a URL da foto é lida sem autenticação
-- (avatar não é sensível); a ESCRITA fica restrita à pasta do próprio usuário.
-- Rode no SQL Editor DEPOIS de 0016.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Enviar/atualizar/remover: só na própria pasta (o primeiro segmento do caminho é o uid).
drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Leitura pública das fotos (o bucket já é público; a policy garante o SELECT no objeto).
drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects
  for select to public
  using (bucket_id = 'avatars');

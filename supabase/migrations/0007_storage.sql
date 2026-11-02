-- FALSE WALLS 0007: storage buckets and policies
-- avatars: public profile pictures. post-media: private; reached only through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('post-media', 'post-media', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types, public = excluded.public;

create policy avatars_read on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy post_media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy post_media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'post-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_staff()
    or exists (select 1 from public.post_media m where m.storage_path = storage.objects.name and (
         (not m.is_hidden and public.can_view_post(m.post_id))
         or (m.is_hidden and exists (select 1 from public.post_reveals r where r.post_id = m.post_id and r.user_id = auth.uid()))))
  ));

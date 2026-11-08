-- FALSE WALLS 0022: private wall backgrounds beyond brick colours: two art pictures, two lifestyle pictures, and an uploaded picture.
alter table public.private_walls drop constraint if exists private_walls_brick_check;
alter table public.private_walls add constraint private_walls_brick_check
  check (brick in ('classic','charcoal','navy','plum','forest','sand','art1','art2','life1','life2','custom'));
alter table public.private_walls add column if not exists bg_path text;
grant update (brick, bg_path, is_active, updated_at) on public.private_walls to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('wall-backgrounds', 'wall-backgrounds', true, 3145728, array['image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = true;
create policy wallbg_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'wall-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy wallbg_delete on storage.objects for delete to authenticated
  using (bucket_id = 'wall-backgrounds' and (storage.foldername(name))[1] = auth.uid()::text);

-- The public wall now also reports the uploaded picture's path.
do $$
declare d text; r record;
begin
  for r in select oid from pg_proc where proname = 'get_private_wall' and pronamespace = 'public'::regnamespace loop
    d := pg_get_functiondef(r.oid);
    d := replace(d, '''brick'', w.brick,', '''brick'', w.brick, ''bg'', case when w.brick = ''custom'' then w.bg_path end,');
    execute d;
  end loop;
end $$;

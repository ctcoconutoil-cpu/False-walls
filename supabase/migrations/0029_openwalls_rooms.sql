-- OPENWALLS 0029: persistent 3D rooms. Structured rows, never a flattened image.
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null default 'My room' check (char_length(name) between 1 and 40),
  size text not null default 'medium' check (size in ('small','medium','large')),
  theme text not null default 'sunset' check (theme in ('sunset','midnight','mint','sand','lilac')),
  category text check (category is null or category in ('music','football','basketball','movies','gaming','fashion','travel','photography','books','technology','lifestyle','art','food')),
  visibility text not null default 'public' check (visibility in ('public','followers','private')),
  visits int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.room_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 40),
  x real not null, z real not null, rot real not null default 0, scale real not null default 1 check (scale between 0.4 and 2.5),
  link_url text check (link_url is null or (char_length(link_url) <= 500 and link_url ~* '^https?://[^[:space:]]+$')),
  note text check (note is null or char_length(note) <= 240)
);
create table public.room_decor (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  wall smallint not null check (wall between 0 and 3),
  u real not null, v real not null, w real not null check (w between 0.15 and 6), h real not null check (h between 0.15 and 6),
  rot real not null default 0, frame text not null default 'wood' check (frame in ('none','wood','black','white','gold')),
  z_index int not null default 0,
  image_path text check (image_path is null or char_length(image_path) <= 200),
  kind text not null default 'picture' check (kind in ('picture','poster','album','movie','sport','travel','artwork','noticeboard')),
  title text check (title is null or char_length(title) <= 60),
  link_url text check (link_url is null or (char_length(link_url) <= 500 and link_url ~* '^https?://[^[:space:]]+$')),
  note text check (note is null or char_length(note) <= 240)
);
create index room_items_room on public.room_items (room_id);
create index room_decor_room on public.room_decor (room_id);
alter table public.rooms enable row level security;
alter table public.room_items enable row level security;
alter table public.room_decor enable row level security;
create policy rooms_read on public.rooms for select to anon, authenticated using (owner_id = auth.uid() or visibility = 'public');
create policy room_items_read on public.room_items for select to anon, authenticated using (exists (select 1 from rooms r where r.id = room_id and (r.owner_id = auth.uid() or r.visibility = 'public')));
create policy room_decor_read on public.room_decor for select to anon, authenticated using (exists (select 1 from rooms r where r.id = room_id and (r.owner_id = auth.uid() or r.visibility = 'public')));
revoke all on public.rooms, public.room_items, public.room_decor from anon, authenticated;
grant select on public.rooms, public.room_items, public.room_decor to anon, authenticated;

-- Saving goes through one function so the whole room is replaced atomically and every value is checked.
create or replace function public.save_room(p_room jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rid uuid; i jsonb;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  perform public.check_rate_limit('save_room', 120, interval '1 hour');
  if jsonb_array_length(coalesce(p_room->'items', '[]')) > 60 or jsonb_array_length(coalesce(p_room->'decor', '[]')) > 40 then raise exception 'room_full'; end if;
  insert into rooms (owner_id, name, size, theme, category, visibility)
  values (uid, coalesce(nullif(left(trim(p_room->>'name'), 40), ''), 'My room'), coalesce(p_room->>'size', 'medium'), coalesce(p_room->>'theme', 'sunset'), nullif(p_room->>'category', ''), coalesce(p_room->>'visibility', 'public'))
  on conflict (owner_id) do update set name = excluded.name, size = excluded.size, theme = excluded.theme, category = excluded.category, visibility = excluded.visibility, updated_at = now()
  returning id into rid;
  delete from room_items where room_id = rid;
  delete from room_decor where room_id = rid;
  for i in select * from jsonb_array_elements(coalesce(p_room->'items', '[]')) loop
    insert into room_items (room_id, kind, x, z, rot, scale, link_url, note)
    values (rid, i->>'kind', (i->>'x')::real, (i->>'z')::real, coalesce((i->>'rot')::real, 0), coalesce((i->>'scale')::real, 1), nullif(i->>'link_url', ''), nullif(left(i->>'note', 240), ''));
  end loop;
  for i in select * from jsonb_array_elements(coalesce(p_room->'decor', '[]')) loop
    if (i->>'image_path') is not null and (i->>'image_path') not like uid::text || '/%' then raise exception 'invalid_media'; end if;
    insert into room_decor (room_id, wall, u, v, w, h, rot, frame, z_index, image_path, kind, title, link_url, note)
    values (rid, (i->>'wall')::smallint, (i->>'u')::real, (i->>'v')::real, (i->>'w')::real, (i->>'h')::real, coalesce((i->>'rot')::real, 0), coalesce(i->>'frame', 'wood'),
            coalesce((i->>'z_index')::int, 0), nullif(i->>'image_path', ''), coalesce(i->>'kind', 'picture'), nullif(left(i->>'title', 60), ''), nullif(i->>'link_url', ''), nullif(left(i->>'note', 240), ''));
  end loop;
  return rid;
end $$;
revoke all on function public.save_room(jsonb) from public, anon;
grant execute on function public.save_room(jsonb) to authenticated;

create or replace function public.record_room_visit(p_room uuid) returns void
language sql security definer set search_path = public as $$
  update rooms set visits = visits + 1 where id = p_room and visibility = 'public' and owner_id is distinct from auth.uid();
$$;
revoke all on function public.record_room_visit(uuid) from public;
grant execute on function public.record_room_visit(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-images', 'room-images', true, 3145728, array['image/webp','image/jpeg','image/png'])
on conflict (id) do nothing;
create policy room_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'room-images' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy room_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'room-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- FALSE WALLS 0019: Experiences and Gist (both live in Discover); private walls drop "Hidden Thoughts".

-- 1. Private walls no longer start with a Hidden Thoughts card.
delete from public.wall_cards where kind = 'prompt' and title = 'Hidden Thoughts';
create or replace function public.create_private_wall(p_brick text default 'classic') returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select lower(username) into uname from profiles where id = uid;
  if exists (select 1 from private_walls where owner_id = uid) then raise exception 'wall_exists'; end if;
  insert into private_walls (owner_id, slug, brick) values (uid, uname, coalesce(p_brick, 'classic'));
  insert into wall_cards (owner_id, kind, title, icon, color) values
    (uid, 'prompt', 'Ask Me Anything', 'mega', 'mustard'),
    (uid, 'prompt', 'Hot Take', 'flame', 'coral');
  return uname;
end $$;

-- 2. Experiences: something to do or go to, with a link out.
create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  description text not null check (char_length(description) between 10 and 600),
  category text not null check (category in ('music','games','food','travel','film','sports','art','learning','wellness','nightlife','community','other')),
  image_path text,
  url text not null check (url ~* '^https?://[^[:space:]]{3,500}$'),
  starts_at timestamptz,
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now()
);
create index experiences_feed_idx on public.experiences (status, created_at desc);
create index experiences_author_idx on public.experiences (author_id);
alter table public.experiences enable row level security;
create policy experiences_read on public.experiences for select to anon, authenticated
  using ((status = 'active' and not public.is_blocked_between(auth.uid(), author_id)) or author_id = auth.uid() or public.is_staff());
create policy experiences_delete_own on public.experiences for delete to authenticated using (author_id = auth.uid() or public.is_staff());
revoke all on public.experiences from anon, authenticated;
grant select on public.experiences to anon, authenticated;
grant delete on public.experiences to authenticated;

create or replace function public.create_experience(p_id uuid, p_title text, p_description text, p_category text, p_image text, p_url text, p_starts timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text := regexp_replace(trim(p_title), '\s+', ' ', 'g'); d text := trim(p_description);
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if public.is_teen(uid) then raise exception 'teen_restricted'; end if;
  if char_length(t) not between 2 and 80 or char_length(d) not between 10 and 600 then raise exception 'invalid_length'; end if;
  if p_url is null or p_url !~* '^https?://[^[:space:]]{3,500}$' then raise exception 'invalid_url'; end if;
  if p_starts is not null and p_starts < now() - interval '1 hour' then raise exception 'date_past'; end if;
  if (select count(*) from experiences where author_id = uid and created_at > now() - interval '1 day') >= 5 then raise exception 'rate_limited'; end if;
  perform public.screen_text(t, d);
  insert into experiences (id, author_id, title, description, category, image_path, url, starts_at)
    values (coalesce(p_id, gen_random_uuid()), uid, t, d, p_category, p_image, p_url, p_starts);
  return p_id;
end $$;
revoke all on function public.create_experience(uuid, text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.create_experience(uuid, text, text, text, text, text, timestamptz) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('experiences', 'experiences', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = excluded.public;
create policy experiences_img_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'experiences' and (storage.foldername(name))[1] = auth.uid()::text and public.is_member());
create policy experiences_img_delete on storage.objects for delete to authenticated
  using (bucket_id = 'experiences' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Gist: short text updates. Only people you follow show up, so nothing appears until you follow someone.
create table public.gists (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now()
);
create index gists_author_idx on public.gists (author_id, created_at desc);
create index gists_feed_idx on public.gists (status, created_at desc);
create table public.gist_likes (
  gist_id uuid not null references public.gists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (gist_id, user_id)
);
alter table public.gists enable row level security;
alter table public.gist_likes enable row level security;
create policy gists_read_own on public.gists for select to authenticated using (author_id = auth.uid() or public.is_staff());
create policy gists_delete_own on public.gists for delete to authenticated using (author_id = auth.uid() or public.is_staff());
revoke all on public.gists, public.gist_likes from anon, authenticated;
grant select, delete on public.gists to authenticated;

create or replace function public.post_gist(p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b text := trim(p_body); gid uuid;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if char_length(b) not between 1 and 280 then raise exception 'invalid_length'; end if;
  if (select count(*) from gists where author_id = uid and created_at > now() - interval '1 day') >= 20 then raise exception 'rate_limited'; end if;
  perform public.screen_text(b);
  insert into gists (author_id, body) values (uid, b) returning id into gid;
  return gid;
end $$;

create or replace function public.toggle_gist_like(p_gist uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from gists g where g.id = p_gist and g.status = 'active' and not public.is_blocked_between(uid, g.author_id)) then raise exception 'not_found'; end if;
  delete from gist_likes where gist_id = p_gist and user_id = uid;
  if found then return false; end if;
  insert into gist_likes (gist_id, user_id) values (p_gist, uid);
  return true;
end $$;

-- p_tab 'following': you and the people you follow. 'foryou': everyone else. Both are empty until you follow someone.
create or replace function public.gist_feed(p_tab text, p_before timestamptz default null, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then return '[]'::jsonb; end if;
  if not exists (select 1 from follows where follower_id = uid) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(row order by (row->>'created_at') desc) from (
      select jsonb_build_object(
        'id', g.id, 'body', g.body, 'created_at', g.created_at, 'mine', g.author_id = uid,
        'likes', (select count(*) from gist_likes l where l.gist_id = g.id),
        'liked', exists (select 1 from gist_likes l where l.gist_id = g.id and l.user_id = uid),
        'author', jsonb_build_object('username', a.username, 'display_name', a.display_name, 'avatar_style', a.avatar_style, 'avatar_color', a.avatar_color, 'avatar_url', a.avatar_url)) as row
      from gists g join profiles a on a.id = g.author_id
      where g.status = 'active' and a.status = 'active'
        and (p_before is null or g.created_at < p_before)
        and not public.is_blocked_between(uid, g.author_id)
        and (case when p_tab = 'foryou'
                  then g.author_id <> uid and not exists (select 1 from follows f where f.follower_id = uid and f.followee_id = g.author_id)
                  else g.author_id = uid or exists (select 1 from follows f where f.follower_id = uid and f.followee_id = g.author_id) end)
      order by g.created_at desc limit least(greatest(p_limit, 1), 40)
    ) t), '[]'::jsonb);
end $$;

-- People worth following: active, not you, not already followed, not blocked or muted. Busiest first.
create or replace function public.suggest_people(p_limit int default 12) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r), '[]'::jsonb) from (
    select a.id, a.username, a.display_name, a.avatar_style, a.avatar_color, a.avatar_url
    from profiles a
    where auth.uid() is not null and a.status = 'active' and a.id <> auth.uid()
      and not exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = a.id)
      and not exists (select 1 from blocks b where (b.blocker_id = auth.uid() and b.blocked_id = a.id) or (b.kind = 'block' and b.blocker_id = a.id and b.blocked_id = auth.uid()))
    order by (select count(*) from follows f where f.followee_id = a.id) desc, a.created_at desc
    limit least(greatest(p_limit, 1), 30)
  ) r;
$$;

revoke all on function public.post_gist(text), public.toggle_gist_like(uuid), public.gist_feed(text, timestamptz, int), public.suggest_people(int) from public, anon;
grant execute on function public.post_gist(text), public.toggle_gist_like(uuid), public.gist_feed(text, timestamptz, int), public.suggest_people(int) to authenticated;

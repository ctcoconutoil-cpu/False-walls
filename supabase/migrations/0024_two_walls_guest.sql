-- FALSE WALLS 0024: up to two private walls per member; private-wall posts stay off the public Wall;
-- visitors react and reply on private-wall posts without an account.

-- 1. A new visibility, "wall": only reachable through a private wall. Public feeds filter on 'public', so these never list there.
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('public','followers','link','wall'));
do $$
declare d text;
begin
  d := pg_get_functiondef('public.post_visible(uuid,text,text)'::regprocedure);
  d := replace(d, 'p_visibility = ''public''', 'p_visibility in (''public'', ''wall'')');
  execute d;
end $$;

-- 2. Several walls per member.
alter table public.private_walls add column if not exists id uuid not null default gen_random_uuid();
alter table public.private_walls add column if not exists n smallint not null default 1 check (n between 1 and 2);
alter table public.private_walls drop constraint if exists private_walls_pkey;
alter table public.private_walls add primary key (id);
create unique index if not exists private_walls_owner_n on public.private_walls (owner_id, n);
alter table public.wall_cards add column if not exists wall_id uuid references public.private_walls (id) on delete cascade;
update public.wall_cards c set wall_id = w.id from public.private_walls w where w.owner_id = c.owner_id and c.wall_id is null;
drop index if exists public.wall_cards_owner_post;
create unique index if not exists wall_cards_wall_post on public.wall_cards (wall_id, post_id) where kind = 'post';
create index if not exists wall_cards_wall on public.wall_cards (wall_id, created_at desc);

create or replace function public.create_private_wall(p_brick text default 'classic') returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text; nn int; sl text;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if (select count(*) from private_walls where owner_id = uid) >= 2 then raise exception 'wall_limit'; end if;
  select lower(username) into uname from profiles where id = uid;
  nn := case when exists (select 1 from private_walls where owner_id = uid and n = 1) then 2 else 1 end;
  sl := case when nn = 1 then uname else left(uname, 27) || '_' || nn end;
  insert into private_walls (owner_id, slug, brick, n) values (uid, sl, coalesce(p_brick, 'classic'), nn);
  return sl;
end $$;

drop function if exists public.add_post_card(uuid);
-- Hangs one of the member's own posts on one of their walls, and takes it off the public Wall.
create or replace function public.pin_to_private_wall(p_post uuid, p_wall uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from private_walls where id = p_wall and owner_id = uid) then raise exception 'no_wall'; end if;
  if (select count(*) from wall_cards where wall_id = p_wall) >= 18 then raise exception 'card_full'; end if;
  if not exists (select 1 from posts where id = p_post and author_id = uid and status = 'active') then raise exception 'not_found'; end if;
  update posts set visibility = 'wall' where id = p_post and visibility in ('public', 'wall');
  insert into wall_cards (owner_id, wall_id, kind, post_id) values (uid, p_wall, 'post', p_post)
    on conflict (wall_id, post_id) where kind = 'post' do nothing returning id into cid;
  return cid;
end $$;
grant execute on function public.pin_to_private_wall(uuid, uuid) to authenticated;

do $$
declare d text; r record;
begin
  for r in select oid from pg_proc where proname = 'get_private_wall' and pronamespace = 'public'::regnamespace loop
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'where c.owner_id = w.owner_id', 'where c.wall_id = w.id');
    d := replace(d, 'p.visibility = ''public''', 'p.visibility in (''public'', ''wall'')');
    execute d;
  end loop;
end $$;

-- 3. Visitors react and reply without an account. A random key kept in their own browser stops repeats.
create table if not exists public.guest_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  key text not null check (char_length(key) between 16 and 80),
  kind text not null check (kind in ('like','funny','surprising','thought_provoking','interesting')),
  created_at timestamptz not null default now(),
  primary key (post_id, key)
);
create table if not exists public.guest_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  key text not null check (char_length(key) between 16 and 80),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists guest_replies_post on public.guest_replies (post_id, created_at);
alter table public.guest_reactions enable row level security;
alter table public.guest_replies enable row level security;
revoke all on public.guest_reactions, public.guest_replies from anon, authenticated;

create or replace function public.guest_wall_post_ok(p_post uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from posts p join profiles a on a.id = p.author_id
                 where p.id = p_post and p.visibility = 'wall' and p.status = 'active' and a.status = 'active');
$$;

create or replace function public.guest_react(p_post uuid, p_kind text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare cur text;
begin
  if p_key is null or char_length(p_key) < 16 then raise exception 'not_authenticated'; end if;
  if not public.guest_wall_post_ok(p_post) then raise exception 'not_found'; end if;
  if p_kind not in ('like','funny','surprising','thought_provoking','interesting') then raise exception 'invalid_input'; end if;
  if (select count(*) from guest_events where key = p_key and action = 'g' and created_at > now() - interval '1 hour') >= 120 then raise exception 'rate_limited'; end if;
  insert into guest_events (key, action) values (p_key, 'g');
  select kind into cur from guest_reactions where post_id = p_post and key = p_key;
  if cur = p_kind then delete from guest_reactions where post_id = p_post and key = p_key;
  else insert into guest_reactions (post_id, key, kind) values (p_post, p_key, p_kind)
       on conflict (post_id, key) do update set kind = excluded.kind, created_at = now(); end if;
end $$;

create or replace function public.guest_reply(p_post uuid, p_body text, p_key text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v text := trim(p_body); rid uuid;
begin
  if p_key is null or char_length(p_key) < 16 then raise exception 'not_authenticated'; end if;
  if not public.guest_wall_post_ok(p_post) then raise exception 'not_found'; end if;
  if char_length(coalesce(v, '')) < 1 or char_length(v) > 500 then raise exception 'invalid_length'; end if;
  if (select count(*) from guest_events where key = p_key and action = 'p' and created_at > now() - interval '1 hour') >= 15 then raise exception 'rate_limited'; end if;
  if exists (select 1 from guest_replies x where x.post_id = p_post and x.key = p_key and lower(x.body) = lower(v) and x.created_at > now() - interval '1 day') then raise exception 'duplicate'; end if;
  if v ~* '(who (are|r) you|reveal (yourself|your name)|i will (find|track) you|i know who you are|doxx?)' then raise exception 'content_not_allowed'; end if;
  perform public.screen_text(v);
  insert into guest_events (key, action) values (p_key, 'p');
  insert into guest_replies (post_id, key, body) values (p_post, p_key, v) returning id into rid;
  return rid;
end $$;

create or replace function public.get_guest_engagement(p_post uuid, p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not public.guest_wall_post_ok(p_post) then null else jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) n from guest_reactions where post_id = p_post group by kind) k), '{}'::jsonb),
    'mine', (select kind from guest_reactions where post_id = p_post and key = p_key),
    'replies', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'body', r.body, 'created_at', r.created_at, 'mine', r.key = p_key) order by r.created_at)
                         from (select * from guest_replies where post_id = p_post order by created_at desc limit 200) r), '[]'::jsonb)
  ) end;
$$;

-- The post's author can remove any visitor reply on their own post.
create or replace function public.delete_guest_reply(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from guest_replies r using posts p where r.id = p_id and p.id = r.post_id and p.author_id = auth.uid();
end $$;
grant execute on function public.guest_react(uuid, text, text), public.guest_reply(uuid, text, text), public.get_guest_engagement(uuid, text) to anon, authenticated;
grant execute on function public.delete_guest_reply(uuid) to authenticated;

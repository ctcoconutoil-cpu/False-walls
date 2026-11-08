-- 0018: Private walls. Every member can have one brick wall of their own at /u/<username>. The owner puts prompt cards
-- on it (like "Roast Me") and can pin public wall posts. Visitors, signed in or not, tap a card and leave an anonymous
-- message that sticks to the wall. Only the owner can read what was sent.

create table public.private_walls (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9_]{3,30}$'),
  brick text not null default 'classic' check (brick in ('classic', 'charcoal', 'navy', 'plum', 'forest', 'sand')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wall_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('prompt', 'post')),
  title text check (title ~ '^[^[:space:]]+( [^[:space:]]+){0,2}$' and char_length(title) <= 36),
  icon text check (icon is null or char_length(icon) between 1 and 8),
  color text not null default 'coral' check (color in ('coral', 'mustard', 'teal', 'violet', 'sky', 'lime', 'rose', 'slate')),
  post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((kind = 'prompt' and title is not null) or (kind = 'post' and post_id is not null))
);
create unique index wall_cards_owner_post on public.wall_cards (owner_id, post_id) where kind = 'post';
create index wall_cards_owner on public.wall_cards (owner_id, created_at desc);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.wall_cards(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index submissions_owner_card on public.submissions (owner_id, card_id, created_at desc);

alter table public.private_walls enable row level security;
alter table public.wall_cards enable row level security;
alter table public.submissions enable row level security;

-- Owners read and tidy their own things. Nothing is written directly: creating walls and cards and sending
-- messages all go through the functions below, which do the checks.
create policy private_walls_owner_read on public.private_walls for select to authenticated using (owner_id = auth.uid());
create policy private_walls_owner_update on public.private_walls for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy wall_cards_owner_read on public.wall_cards for select to authenticated using (owner_id = auth.uid());
create policy wall_cards_owner_delete on public.wall_cards for delete to authenticated using (owner_id = auth.uid());
create policy submissions_owner_read on public.submissions for select to authenticated using (owner_id = auth.uid());
create policy submissions_owner_update on public.submissions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy submissions_owner_delete on public.submissions for delete to authenticated using (owner_id = auth.uid());

revoke all on public.private_walls, public.wall_cards, public.submissions from anon, authenticated;
grant select on public.private_walls, public.wall_cards, public.submissions to authenticated;
grant update (brick, is_active, updated_at) on public.private_walls to authenticated;
grant delete on public.wall_cards, public.submissions to authenticated;
grant update (read_at) on public.submissions to authenticated;

create or replace function public.create_private_wall(p_brick text default 'classic') returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select lower(username) into uname from profiles where id = uid;
  if exists (select 1 from private_walls where owner_id = uid) then raise exception 'wall_exists'; end if;
  insert into private_walls (owner_id, slug, brick) values (uid, uname, coalesce(p_brick, 'classic'));
  -- A new wall starts with three prompts so it is never bare.
  insert into wall_cards (owner_id, kind, title, icon, color) values
    (uid, 'prompt', 'Ask Me Anything', 'mega', 'mustard'),
    (uid, 'prompt', 'Hot Take', 'flame', 'coral'),
    (uid, 'prompt', 'Hidden Thoughts', 'eye', 'violet');
  return uname;
end $$;

create or replace function public.add_prompt_card(p_title text, p_icon text, p_color text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; t text := regexp_replace(trim(p_title), '\s+', ' ', 'g');
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from private_walls where owner_id = uid) then raise exception 'no_wall'; end if;
  if (select count(*) from wall_cards where owner_id = uid) >= 18 then raise exception 'card_full'; end if;
  if t !~ '^[^[:space:]]+( [^[:space:]]+){0,2}$' or char_length(t) > 36 then raise exception 'invalid_input'; end if;
  perform public.screen_text(t);
  insert into wall_cards (owner_id, kind, title, icon, color) values (uid, 'prompt', t, p_icon, coalesce(p_color, 'coral')) returning id into cid;
  return cid;
end $$;

create or replace function public.add_post_card(p_post uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from private_walls where owner_id = uid) then raise exception 'no_wall'; end if;
  if (select count(*) from wall_cards where owner_id = uid) >= 18 then raise exception 'card_full'; end if;
  if not exists (select 1 from posts where id = p_post and status = 'active' and visibility = 'public') then raise exception 'not_found'; end if;
  insert into wall_cards (owner_id, kind, post_id) values (uid, 'post', p_post)
    on conflict (owner_id, post_id) where kind = 'post' do nothing returning id into cid;
  return cid;
end $$;

-- What a visitor is allowed to see: the wall's look and its cards. Never any message.
create or replace function public.get_private_wall(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slug', w.slug, 'brick', w.brick,
    'accepting', coalesce(s.allow_anonymous_questions, false) and not public.is_teen(w.owner_id),
    'owner', jsonb_build_object('username', a.username, 'display_name', a.display_name, 'avatar_style', a.avatar_style, 'avatar_color', a.avatar_color, 'avatar_url', a.avatar_url),
    'cards', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'kind', c.kind, 'title', c.title, 'icon', c.icon, 'color', c.color, 'post_id', c.post_id) order by c.created_at desc)
                       from wall_cards c where c.owner_id = w.owner_id
                         and (c.kind = 'prompt' or exists (select 1 from posts p where p.id = c.post_id and p.status = 'active' and p.visibility = 'public'))), '[]'::jsonb))
  from private_walls w
  join profiles a on a.id = w.owner_id and a.status = 'active'
  left join user_settings s on s.user_id = w.owner_id
  where w.slug = lower(p_slug) and w.is_active;
$$;

create or replace function public.submit_to_card(p_card uuid, p_body text, p_key text) returns uuid
language plpgsql security definer set search_path = public as $$
declare c wall_cards%rowtype; s user_settings%rowtype; sid uuid; v_body text := trim(p_body);
begin
  if p_key is null or char_length(p_key) < 16 then raise exception 'not_authenticated'; end if;
  select * into c from wall_cards where id = p_card and kind = 'prompt';
  if not found or not exists (select 1 from private_walls w join profiles a on a.id = w.owner_id where w.owner_id = c.owner_id and w.is_active and a.status = 'active') then
    raise exception 'not_found';
  end if;
  select * into s from user_settings where user_id = c.owner_id;
  if not coalesce(s.allow_anonymous_questions, false) or public.is_teen(c.owner_id) then raise exception 'anonymous_disabled'; end if;
  if char_length(coalesce(v_body, '')) < 1 or char_length(v_body) > 500 then raise exception 'invalid_length'; end if;
  if (select count(*) from guest_events where key = p_key and action = 's' and created_at > now() - interval '1 hour') >= 10
     or (select count(*) from guest_events where key = p_key and action = 's' and created_at > now() - interval '1 day') >= 40 then
    raise exception 'rate_limited';
  end if;
  if (select count(*) from submissions where card_id = c.id and created_at > now() - interval '1 hour') >= 200 then raise exception 'rate_limited'; end if;
  if exists (select 1 from submissions x where x.card_id = c.id and lower(x.body) = lower(v_body) and x.created_at > now() - interval '7 days') then raise exception 'duplicate'; end if;
  if v_body ~* '(who (are|r) you|reveal (yourself|your name)|i will (find|track) you|i know who you are|doxx?)' then raise exception 'content_not_allowed'; end if;
  perform public.screen_text(v_body);
  insert into guest_events (key, action) values (p_key, 's');
  if random() < 0.02 then delete from guest_events where created_at < now() - interval '2 days'; end if;
  insert into submissions (card_id, owner_id, body) values (c.id, c.owner_id, v_body) returning id into sid;
  return sid;
end $$;

-- The numbers on the owner's cards.
create or replace function public.private_wall_counts() returns table (card_id uuid, total bigint, unread bigint)
language sql stable security definer set search_path = public as $$
  select s.card_id, count(*), count(*) filter (where s.read_at is null) from submissions s where s.owner_id = auth.uid() group by s.card_id;
$$;

revoke all on function public.create_private_wall(text), public.add_prompt_card(text, text, text), public.add_post_card(uuid), public.private_wall_counts() from public, anon;
grant execute on function public.create_private_wall(text), public.add_prompt_card(text, text, text), public.add_post_card(uuid), public.private_wall_counts() to authenticated;
revoke all on function public.get_private_wall(text), public.submit_to_card(uuid, text, text) from public;
grant execute on function public.get_private_wall(text), public.submit_to_card(uuid, text, text) to anon, authenticated;

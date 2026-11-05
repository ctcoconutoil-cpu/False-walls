-- FALSE WALLS 0015: ADVENTURE (optional game mode)
-- Professions, collectible objects, riddles, finds, teams, team chat, milestones/rewards, Animated Fire reaction.
-- Every table is closed to clients (RLS on, no policies); the app talks to it only through the SECURITY DEFINER functions below.

-- ---------- content (managed by admins) ----------
create table public.adv_professions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 40),
  emoji text not null default '🎯',
  color text not null default '#F2573F',
  blurb text,
  sort_order int not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.adv_objects (
  id uuid primary key default gen_random_uuid(),
  profession_id uuid not null references public.adv_professions (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  emoji text not null default '❓',
  image_path text,
  rarity text not null default 'common' check (rarity in ('common','rare')),
  area text not null default 'main' check (area in ('main','trending','hidden','picture','question','community')),
  section int not null default 0 check (section between 0 and 50),
  placement text not null default 'corridor' check (placement in ('dead_end','corner','junction','corridor','room')),
  tile_x int check (tile_x between 0 and 16),
  tile_y int check (tile_y between 0 and 16),
  visibility text not null default 'clear' check (visibility in ('clear','hidden')),
  per_player boolean not null default false,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check ((tile_x is null) = (tile_y is null))
);
create index adv_objects_prof_idx on public.adv_objects (profession_id) where active;
create index adv_objects_area_idx on public.adv_objects (area) where active;

-- kind: riddle = guess the object; silhouette = guess from its shadow; direct = a plain clue, nothing to solve.
create table public.adv_riddles (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null unique references public.adv_objects (id) on delete cascade,
  kind text not null default 'riddle' check (kind in ('riddle','silhouette','direct')),
  prompt text not null check (char_length(prompt) between 3 and 300),
  hint text,
  difficulty int not null default 1 check (difficulty between 1 and 3),
  answers text[] not null default '{}',
  active boolean not null default true
);

create table public.adv_milestones (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9_-]{2,40}$'),
  title text not null check (char_length(title) between 2 and 40),
  description text not null default '',
  icon text not null default '★',
  color text not null default '#F7B538',
  metric text not null check (metric in ('objects','riddles','collections','team_collections','sections','rare','challenges')),
  threshold int not null check (threshold >= 1),
  reward text not null default 'badge' check (reward in ('badge','fire')),
  sort_order int not null default 0,
  active boolean not null default true
);

-- ---------- player data ----------
create table public.adv_players (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  active_profession uuid references public.adv_professions (id) on delete set null,
  active_team uuid,
  joined_at timestamptz not null default now(),
  last_collect_at timestamptz
);

create table public.adv_solves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  riddle_id uuid not null references public.adv_riddles (id) on delete cascade,
  solved_at timestamptz not null default now(),
  primary key (user_id, riddle_id)
);

create table public.adv_teams (
  id uuid primary key default gen_random_uuid(),
  profession_id uuid not null references public.adv_professions (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 40),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active','complete','disbanded')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.adv_players add constraint adv_players_team_fk foreign key (active_team) references public.adv_teams (id) on delete set null;

create table public.adv_team_members (
  team_id uuid not null references public.adv_teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','active','declined')),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (team_id, user_id)
);
create index adv_team_members_user_idx on public.adv_team_members (user_id, status);

-- One personal row per player per object, so a repeat can never raise progress.
create table public.adv_finds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  object_id uuid not null references public.adv_objects (id) on delete cascade,
  team_id uuid references public.adv_teams (id) on delete set null,
  found_at timestamptz not null default now(),
  unique (user_id, object_id)
);
create index adv_finds_user_idx on public.adv_finds (user_id);

-- One shared row per team per object: the team's progress, and who found it.
create table public.adv_team_finds (
  team_id uuid not null references public.adv_teams (id) on delete cascade,
  object_id uuid not null references public.adv_objects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  found_at timestamptz not null default now(),
  primary key (team_id, object_id)
);

create table public.adv_team_messages (
  id bigserial primary key,
  team_id uuid not null references public.adv_teams (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text','discovery')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index adv_team_messages_idx on public.adv_team_messages (team_id, id desc);

create table public.adv_team_reads (
  team_id uuid not null references public.adv_teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_id bigint not null default 0,
  primary key (team_id, user_id)
);

create table public.adv_user_rewards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  milestone_id uuid not null references public.adv_milestones (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, milestone_id)
);

do $$ declare t text; begin
  foreach t in array array['adv_professions','adv_objects','adv_riddles','adv_milestones','adv_players','adv_solves','adv_teams','adv_team_members','adv_finds','adv_team_finds','adv_team_messages','adv_team_reads','adv_user_rewards'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence public.adv_team_messages_id_seq from anon, authenticated;

-- Notifications and reactions learn the new kinds.
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('question','answer','reply','reaction','follow','chain','badge','discovery','adventure'));
alter table public.reactions drop constraint reactions_kind_check;
alter table public.reactions add constraint reactions_kind_check
  check (kind in ('interesting','funny','surprising','thought_provoking','like','fire'));

-- ---------- helpers ----------
create or replace function public.adv_norm(t text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(lower(trim(coalesce(t, ''))), '^(a|an|the)[[:space:]]+', ''), '[^a-z0-9]', '', 'g');
$$;

-- Is a profession currently open? (active and inside its optional time window)
create or replace function public.adv_open(p public.adv_professions) returns boolean language sql stable as $$
  select p.active and (p.starts_at is null or p.starts_at <= now()) and (p.ends_at is null or p.ends_at > now());
$$;

-- An object can be hunted once its riddle is solved. Objects without a riddle, and direct clues, are open from the start.
create or replace function public.adv_unlocked(p_user uuid, p_object uuid) returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from adv_riddles r where r.object_id = p_object and r.active and r.kind <> 'direct')
      or exists (select 1 from adv_riddles r join adv_solves s on s.riddle_id = r.id and s.user_id = p_user where r.object_id = p_object);
$$;

create or replace function public.adv_metric(p_user uuid, p_metric text) returns int language plpgsql stable security definer set search_path = public as $$
declare v int;
begin
  if p_metric = 'objects' then select count(*) into v from adv_finds where user_id = p_user;
  elsif p_metric = 'riddles' then select count(*) into v from adv_solves where user_id = p_user;
  elsif p_metric = 'rare' then select count(*) into v from adv_finds f join adv_objects o on o.id = f.object_id where f.user_id = p_user and o.rarity = 'rare';
  elsif p_metric = 'sections' then select count(distinct o.area) into v from adv_finds f join adv_objects o on o.id = f.object_id where f.user_id = p_user;
  elsif p_metric = 'collections' then
    select count(*) into v from adv_professions p
     where exists (select 1 from adv_objects o where o.profession_id = p.id and o.active)
       and not exists (select 1 from adv_objects o where o.profession_id = p.id and o.active
                        and not exists (select 1 from adv_finds f where f.user_id = p_user and f.object_id = o.id));
  elsif p_metric = 'team_collections' then
    select count(*) into v from adv_teams t join adv_team_members m on m.team_id = t.id and m.user_id = p_user and m.status = 'active' where t.status = 'complete';
  elsif p_metric = 'challenges' then v := public.adv_metric(p_user, 'collections') + public.adv_metric(p_user, 'team_collections');
  else v := 0; end if;
  return coalesce(v, 0);
end $$;

create or replace function public.adv_xp(p_user uuid) returns int language sql stable security definer set search_path = public as $$
  select public.adv_metric(p_user, 'objects') * 10 + public.adv_metric(p_user, 'riddles') * 5
       + public.adv_metric(p_user, 'collections') * 50 + public.adv_metric(p_user, 'team_collections') * 50;
$$;

-- Hands out every milestone the player has reached, exactly once, and returns the titles that are new.
create or replace function public.adv_award(p_user uuid) returns text[] language plpgsql security definer set search_path = public as $$
declare m adv_milestones%rowtype; got text[] := '{}'; n int;
begin
  for m in select * from adv_milestones where active order by sort_order loop
    if public.adv_metric(p_user, m.metric) >= m.threshold then
      insert into adv_user_rewards (user_id, milestone_id) values (p_user, m.id) on conflict do nothing;
      get diagnostics n = row_count;
      if n > 0 then
        got := got || m.title;
        perform public.notify(p_user, case when m.reward = 'fire' then 'adventure' else 'badge' end, null, null,
          jsonb_build_object('name', m.title, 'adventure', true, 'reward', m.reward));
      end if;
    end if;
  end loop;
  return got;
end $$;

create or replace function public.adv_has_fire(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from adv_user_rewards r join adv_milestones m on m.id = r.milestone_id where r.user_id = p_user and m.reward = 'fire');
$$;

-- ---------- reactions: the Animated Fire is a reward ----------
create or replace function public.set_reaction(p_type text, p_id uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); owner uuid; pid uuid;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if not public.can_view_target(p_type, p_id) then raise exception 'not_found'; end if;
  if p_type = 'post' then select author_id, id into owner, pid from posts where id = p_id;
  elsif p_type = 'answer' then select author_id, post_id into owner, pid from answers where id = p_id;
  else select author_id, post_id into owner, pid from replies where id = p_id; end if;
  if owner = uid then raise exception 'own_content'; end if;
  if p_kind is null then
    delete from reactions where user_id = uid and target_type = p_type and target_id = p_id;
    return;
  end if;
  if p_kind not in ('interesting','funny','surprising','thought_provoking','like','fire') then raise exception 'invalid_reaction'; end if;
  if p_kind = 'fire' and not public.adv_has_fire(uid) then raise exception 'fire_locked'; end if;
  perform public.check_rate_limit('react', 120, interval '1 hour');
  insert into reactions (user_id, target_type, target_id, kind) values (uid, p_type, p_id, p_kind)
    on conflict (user_id, target_type, target_id) do update set kind = excluded.kind;
  perform public.notify(owner, 'reaction', uid, pid, jsonb_build_object('target_type', p_type, 'kind', p_kind));
  perform public.award_badges(uid);
end $$;

-- Who used the Fire reaction on something: only people with public profiles, never anyone the viewer has blocked.
create or replace function public.fire_reactors(p_type text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not public.can_view_target(p_type, p_id) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('username', pr.username, 'display_name', pr.display_name, 'avatar_style', pr.avatar_style,
                                                       'avatar_color', pr.avatar_color, 'avatar_url', pr.avatar_url) order by r.created_at desc)
                     from reactions r join profiles pr on pr.id = r.user_id and pr.status = 'active'
                     join user_settings s on s.user_id = pr.id
                    where r.target_type = p_type and r.target_id = p_id and r.kind = 'fire'
                      and (s.profile_public or r.user_id = uid)
                      and (uid is null or not public.is_blocked_between(uid, r.user_id))), '[]'::jsonb);
end $$;

-- ---------- the player ----------
create or replace function public.adv_progress(p_user uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'objects', public.adv_metric(p_user, 'objects'), 'riddles', public.adv_metric(p_user, 'riddles'),
    'collections', public.adv_metric(p_user, 'collections'), 'team_collections', public.adv_metric(p_user, 'team_collections'),
    'sections', public.adv_metric(p_user, 'sections'), 'rare', public.adv_metric(p_user, 'rare'),
    'xp', public.adv_xp(p_user), 'level', 1 + public.adv_xp(p_user) / 100, 'xp_into', public.adv_xp(p_user) % 100, 'xp_per_level', 100,
    'fire', public.adv_has_fire(p_user),
    'next', (select jsonb_build_object('title', m.title, 'metric', m.metric, 'threshold', m.threshold, 'current', public.adv_metric(p_user, m.metric), 'icon', m.icon)
               from adv_milestones m
              where m.active and not exists (select 1 from adv_user_rewards r where r.user_id = p_user and r.milestone_id = m.id)
              order by (public.adv_metric(p_user, m.metric)::numeric / m.threshold) desc, m.sort_order limit 1));
$$;

create or replace function public.adv_join(p_slug text, p_team uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p adv_professions%rowtype;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select * into p from adv_professions where slug = p_slug;
  if not found or not public.adv_open(p) then raise exception 'not_found'; end if;
  if p_team is not null and not exists (select 1 from adv_team_members m join adv_teams t on t.id = m.team_id
        where m.team_id = p_team and m.user_id = uid and m.status = 'active' and t.profession_id = p.id and t.status = 'active') then
    raise exception 'not_found';
  end if;
  insert into adv_players (user_id, active_profession, active_team) values (uid, p.id, p_team)
    on conflict (user_id) do update set active_profession = excluded.active_profession, active_team = excluded.active_team;
end $$;

create or replace function public.adv_pause() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  update adv_players set active_profession = null, active_team = null where user_id = auth.uid();
end $$;

-- Riddle answers are checked here and never sent to the browser.
create or replace function public.adv_answer(p_riddle uuid, p_answer text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r adv_riddles%rowtype; o adv_objects%rowtype; n text := public.adv_norm(p_answer); ok boolean; fresh boolean := false;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  perform public.check_rate_limit('adv_answer', 90, interval '1 hour');
  select * into r from adv_riddles where id = p_riddle and active;
  if not found then raise exception 'not_found'; end if;
  select * into o from adv_objects where id = r.object_id and active;
  if not found or not exists (select 1 from adv_professions p where p.id = o.profession_id and public.adv_open(p)) then raise exception 'not_found'; end if;
  if char_length(n) < 1 then raise exception 'invalid_length'; end if;
  ok := exists (select 1 from unnest(array_append(r.answers, o.name)) a
                where public.adv_norm(a) = n or public.adv_norm(a) || 's' = n or public.adv_norm(a) = n || 's');
  if not ok then return jsonb_build_object('correct', false); end if;
  insert into adv_solves (user_id, riddle_id) values (uid, r.id) on conflict do nothing;
  get diagnostics fresh = row_count;
  return jsonb_build_object('correct', true, 'object', jsonb_build_object('id', o.id, 'name', o.name, 'emoji', o.emoji, 'image_path', o.image_path),
                            'rewards', case when fresh then to_jsonb(public.adv_award(uid)) else '[]'::jsonb end);
end $$;

-- Picking an object up. The server decides whether it counts; the browser only says which object and which team.
create or replace function public.adv_collect(p_object uuid, p_team uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); o adv_objects%rowtype; p adv_professions%rowtype; pl adv_players%rowtype;
        mine boolean := false; shared boolean := false; n int; total int; tfound int; rewards text[]; m record; t adv_teams%rowtype;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  perform public.check_rate_limit('adv_collect', 120, interval '1 hour');
  select * into pl from adv_players where user_id = uid;
  if not found or pl.active_profession is null then raise exception 'not_found'; end if;
  if pl.last_collect_at is not null and pl.last_collect_at > now() - interval '1 second' then raise exception 'rate_limited'; end if;
  select * into o from adv_objects where id = p_object and active and profession_id = pl.active_profession;
  if not found then raise exception 'not_found'; end if;
  select * into p from adv_professions where id = o.profession_id;
  if not public.adv_open(p) then raise exception 'not_found'; end if;
  if not public.adv_unlocked(uid, o.id) then raise exception 'not_unlocked'; end if;
  if p_team is not null then
    select * into t from adv_teams where id = p_team and status = 'active' and profession_id = o.profession_id;
    if not found or not exists (select 1 from adv_team_members m2 where m2.team_id = p_team and m2.user_id = uid and m2.status = 'active') then raise exception 'not_found'; end if;
    insert into adv_team_finds (team_id, object_id, user_id) values (p_team, o.id, uid) on conflict do nothing;
    get diagnostics n = row_count; shared := n > 0;
  end if;
  if p_team is null or shared then
    insert into adv_finds (user_id, object_id, team_id) values (uid, o.id, case when shared then p_team end) on conflict do nothing;
    get diagnostics n = row_count; mine := n > 0;
  end if;
  if not mine and not shared then raise exception 'already_collected'; end if;
  update adv_players set last_collect_at = now() where user_id = uid;

  select count(*) into total from adv_objects where profession_id = o.profession_id and active;
  if shared then
    select count(*) into tfound from adv_team_finds f join adv_objects ob on ob.id = f.object_id where f.team_id = p_team and ob.active;
    insert into adv_team_messages (team_id, user_id, kind, body)
      values (p_team, uid, 'discovery', 'found the ' || o.name || ' ' || o.emoji || ' (' || tfound || '/' || total || ')');
    if tfound >= total then
      update adv_teams set status = 'complete', completed_at = now() where id = p_team and status = 'active';
      update adv_players set active_team = null where active_team = p_team;
      for m in select user_id from adv_team_members where team_id = p_team and status = 'active' loop
        perform public.adv_award(m.user_id);
        perform public.notify(m.user_id, 'adventure', uid, null, jsonb_build_object('team_id', p_team, 'event', 'complete', 'name', t.name));
      end loop;
    end if;
  end if;
  rewards := public.adv_award(uid);
  return jsonb_build_object(
    'object', jsonb_build_object('id', o.id, 'name', o.name, 'emoji', o.emoji, 'image_path', o.image_path, 'rarity', o.rarity),
    'mine', mine, 'shared', shared, 'total', total,
    'found', (select count(*) from adv_finds f join adv_objects ob on ob.id = f.object_id where f.user_id = uid and ob.profession_id = o.profession_id and ob.active),
    'team_found', tfound, 'rewards', to_jsonb(rewards));
end $$;

-- ---------- reading ----------
-- What to draw in the maze for this area: the active profession's unlocked, not-yet-collected objects. Names only for unlocked objects.
create or replace function public.adv_maze(p_area text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); pl adv_players%rowtype; p adv_professions%rowtype;
begin
  if uid is null then return null; end if;
  select * into pl from adv_players where user_id = uid;
  if not found or pl.active_profession is null then return null; end if;
  select * into p from adv_professions where id = pl.active_profession;
  if not found or not public.adv_open(p) then return null; end if;
  return jsonb_build_object(
    'profession', jsonb_build_object('slug', p.slug, 'name', p.name, 'emoji', p.emoji, 'color', p.color),
    'team_id', pl.active_team,
    'objects', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'emoji', o.emoji, 'image_path', o.image_path, 'rarity', o.rarity,
                'visibility', o.visibility, 'placement', o.placement, 'tile_x', o.tile_x, 'tile_y', o.tile_y, 'section', o.section, 'per_player', o.per_player) order by o.sort_order)
              from adv_objects o
             where o.profession_id = p.id and o.active and o.area = p_area and public.adv_unlocked(uid, o.id)
               and (case when pl.active_team is not null
                         then not exists (select 1 from adv_team_finds f where f.team_id = pl.active_team and f.object_id = o.id)
                         else not exists (select 1 from adv_finds f where f.user_id = uid and f.object_id = o.id) end)), '[]'::jsonb));
end $$;

create or replace function public.adv_overview() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); pl adv_players%rowtype;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select * into pl from adv_players where user_id = uid;
  return jsonb_build_object(
    'joined', pl.user_id is not null,
    'active', jsonb_build_object('profession_id', pl.active_profession, 'team_id', pl.active_team),
    'progress', public.adv_progress(uid),
    'professions', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'name', p.name, 'emoji', p.emoji, 'color', p.color, 'blurb', p.blurb,
          'ends_at', p.ends_at, 'total', (select count(*) from adv_objects o where o.profession_id = p.id and o.active),
          'found', (select count(*) from adv_finds f join adv_objects o on o.id = f.object_id where f.user_id = uid and o.profession_id = p.id and o.active))
          order by p.sort_order, p.name)
        from adv_professions p where public.adv_open(p) and exists (select 1 from adv_objects o where o.profession_id = p.id and o.active)), '[]'::jsonb),
    'missions', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('riddle_id', r.id, 'kind', r.kind, 'prompt', r.prompt, 'hint', r.hint, 'difficulty', r.difficulty,
               'profession', p.name, 'slug', p.slug, 'color', p.color, 'profession_emoji', p.emoji,
               'solved', exists (select 1 from adv_solves s where s.riddle_id = r.id and s.user_id = uid),
               'emoji', case when r.kind in ('silhouette','direct') then o.emoji end, 'name', case when r.kind = 'direct' then o.name end) x
          from adv_riddles r join adv_objects o on o.id = r.object_id and o.active join adv_professions p on p.id = o.profession_id
         where r.active and public.adv_open(p) and not exists (select 1 from adv_finds f where f.user_id = uid and f.object_id = o.id)
         order by (p.id = pl.active_profession) desc nulls last, r.difficulty, p.sort_order, o.sort_order limit 8) q), '[]'::jsonb),
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'profession', p.name, 'slug', p.slug, 'emoji', p.emoji, 'color', p.color,
          'members', (select count(*) from adv_team_members m2 where m2.team_id = t.id and m2.status = 'active'),
          'found', (select count(*) from adv_team_finds f join adv_objects o on o.id = f.object_id where f.team_id = t.id and o.active),
          'total', (select count(*) from adv_objects o where o.profession_id = p.id and o.active),
          'unread', (select count(*) from adv_team_messages g where g.team_id = t.id and g.user_id is distinct from uid
                       and g.id > coalesce((select r.last_id from adv_team_reads r where r.team_id = t.id and r.user_id = uid), 0)))
          order by t.created_at desc)
        from adv_team_members m join adv_teams t on t.id = m.team_id and t.status <> 'disbanded' join adv_professions p on p.id = t.profession_id
       where m.user_id = uid and m.status = 'active'), '[]'::jsonb),
    'invites', coalesce((select jsonb_agg(jsonb_build_object('team_id', t.id, 'name', t.name, 'profession', p.name, 'emoji', p.emoji, 'from', pr.username))
        from adv_team_members m join adv_teams t on t.id = m.team_id and t.status = 'active' join adv_professions p on p.id = t.profession_id
        left join profiles pr on pr.id = m.invited_by where m.user_id = uid and m.status = 'invited'), '[]'::jsonb));
end $$;

create or replace function public.adv_collection(p_slug text, p_team uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); p adv_professions%rowtype; pl adv_players%rowtype;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select * into p from adv_professions where slug = p_slug;
  if not found or not public.adv_open(p) then raise exception 'not_found'; end if;
  select * into pl from adv_players where user_id = uid;
  return jsonb_build_object(
    'profession', jsonb_build_object('id', p.id, 'slug', p.slug, 'name', p.name, 'emoji', p.emoji, 'color', p.color, 'blurb', p.blurb, 'ends_at', p.ends_at),
    'playing', pl.active_profession = p.id, 'active_team', case when pl.active_profession = p.id then pl.active_team end,
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)) from adv_team_members m join adv_teams t on t.id = m.team_id
                        where m.user_id = uid and m.status = 'active' and t.status = 'active' and t.profession_id = p.id), '[]'::jsonb),
    'objects', coalesce((select jsonb_agg(y order by (y->>'sort')::int) from (
        select jsonb_build_object('id', o.id, 'sort', o.sort_order, 'rarity', o.rarity, 'found', f.id is not null, 'found_at', f.found_at, 'via_team', f.team_id is not null,
               'unlocked', public.adv_unlocked(uid, o.id),
               'name', case when f.id is not null or public.adv_unlocked(uid, o.id) then o.name end,
               'emoji', case when f.id is not null or public.adv_unlocked(uid, o.id) then o.emoji end,
               'image_path', case when f.id is not null or public.adv_unlocked(uid, o.id) then o.image_path end,
               'area', case when f.id is not null then o.area end,
               'mission', case when r.id is not null then jsonb_build_object('riddle_id', r.id, 'kind', r.kind, 'prompt', r.prompt, 'hint', r.hint, 'difficulty', r.difficulty,
                    'solved', exists (select 1 from adv_solves s where s.riddle_id = r.id and s.user_id = uid),
                    'silhouette', case when r.kind = 'silhouette' then o.emoji end) end) y
          from adv_objects o left join adv_finds f on f.object_id = o.id and f.user_id = uid
          left join adv_riddles r on r.object_id = o.id and r.active
         where o.profession_id = p.id and o.active) z), '[]'::jsonb));
end $$;

create or replace function public.adv_book() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('slug', p.slug, 'name', p.name, 'emoji', p.emoji, 'color', p.color,
      'total', (select count(*) from adv_objects o where o.profession_id = p.id and o.active),
      'found', (select count(*) from adv_finds f join adv_objects o on o.id = f.object_id where f.user_id = uid and o.profession_id = p.id and o.active),
      'items', coalesce((select jsonb_agg(jsonb_build_object('name', o.name, 'emoji', o.emoji, 'image_path', o.image_path, 'rarity', o.rarity, 'found_at', f.found_at,
                 'via_team', f.team_id is not null, 'found', f.id is not null) order by f.found_at nulls last, o.sort_order)
               from adv_objects o left join adv_finds f on f.object_id = o.id and f.user_id = uid where o.profession_id = p.id and o.active), '[]'::jsonb))
      order by p.sort_order, p.name)
    from adv_professions p where public.adv_open(p) and exists (select 1 from adv_objects o where o.profession_id = p.id and o.active)), '[]'::jsonb);
end $$;

create or replace function public.adv_rewards() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  return jsonb_build_object('progress', public.adv_progress(uid), 'items', coalesce((select jsonb_agg(jsonb_build_object(
      'slug', m.slug, 'title', m.title, 'description', m.description, 'icon', m.icon, 'color', m.color, 'reward', m.reward, 'metric', m.metric, 'threshold', m.threshold,
      'current', least(public.adv_metric(uid, m.metric), m.threshold), 'earned_at', r.earned_at, 'earned', r.user_id is not null) order by m.sort_order)
    from adv_milestones m left join adv_user_rewards r on r.milestone_id = m.id and r.user_id = uid where m.active), '[]'::jsonb));
end $$;

-- Badges to show on someone's public profile.
create or replace function public.adv_profile(p_user uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('fire', public.adv_has_fire(p_user), 'level', 1 + public.adv_xp(p_user) / 100,
    'badges', coalesce((select jsonb_agg(jsonb_build_object('slug', m.slug, 'title', m.title, 'icon', m.icon, 'color', m.color, 'reward', m.reward) order by r.earned_at)
                          from adv_user_rewards r join adv_milestones m on m.id = r.milestone_id where r.user_id = p_user), '[]'::jsonb));
$$;

-- ---------- teams ----------
-- Friends are people who follow each other.
create or replace function public.adv_friends(p_team uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'username', pr.username, 'display_name', pr.display_name, 'avatar_style', pr.avatar_style,
                                                       'avatar_color', pr.avatar_color, 'avatar_url', pr.avatar_url) order by pr.username)
    from follows a join follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id
    join profiles pr on pr.id = a.followee_id and pr.status = 'active'
   where a.follower_id = uid and not public.is_blocked_between(uid, pr.id)
     and (p_team is null or not exists (select 1 from adv_team_members m where m.team_id = p_team and m.user_id = pr.id and m.status in ('active','invited')))), '[]'::jsonb);
end $$;

create or replace function public.adv_invite_one(p_team uuid, p_user uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t adv_teams%rowtype;
begin
  select * into t from adv_teams where id = p_team and status = 'active';
  if not found then raise exception 'not_found'; end if;
  if not exists (select 1 from adv_team_members where team_id = p_team and user_id = uid and status = 'active') then raise exception 'not_found'; end if;
  if not exists (select 1 from follows a join follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id where a.follower_id = uid and a.followee_id = p_user)
     or public.is_blocked_between(uid, p_user) then raise exception 'not_friends'; end if;
  if (select count(*) from adv_team_members where team_id = p_team and status in ('active','invited')) >= 6 then raise exception 'team_full'; end if;
  insert into adv_team_members (team_id, user_id, status, invited_by) values (p_team, p_user, 'invited', uid)
    on conflict (team_id, user_id) do update set status = 'invited', invited_by = excluded.invited_by, created_at = now()
      where adv_team_members.status = 'declined';
  perform public.notify(p_user, 'adventure', uid, null, jsonb_build_object('team_id', p_team, 'event', 'invite', 'name', t.name));
end $$;

create or replace function public.adv_team_create(p_slug text, p_name text, p_invitees uuid[] default '{}') returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p adv_professions%rowtype; tid uuid; u uuid; nm text := trim(p_name);
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  perform public.check_rate_limit('adv_team', 10, interval '1 day');
  select * into p from adv_professions where slug = p_slug;
  if not found or not public.adv_open(p) then raise exception 'not_found'; end if;
  if char_length(nm) < 2 or char_length(nm) > 40 then raise exception 'invalid_length'; end if;
  perform public.screen_text(nm);
  insert into adv_teams (profession_id, name, owner_id) values (p.id, nm, uid) returning id into tid;
  insert into adv_team_members (team_id, user_id, status, joined_at) values (tid, uid, 'active', now());
  foreach u in array coalesce(p_invitees, '{}') loop perform public.adv_invite_one(tid, u); end loop;
  insert into adv_players (user_id, active_profession, active_team) values (uid, p.id, tid)
    on conflict (user_id) do update set active_profession = excluded.active_profession, active_team = excluded.active_team;
  return tid;
end $$;

create or replace function public.adv_team_invite(p_team uuid, p_users uuid[]) returns void language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  if auth.uid() is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  perform public.check_rate_limit('adv_invite', 30, interval '1 day');
  foreach u in array coalesce(p_users, '{}') loop perform public.adv_invite_one(p_team, u); end loop;
end $$;

create or replace function public.adv_team_respond(p_team uuid, p_accept boolean) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from adv_team_members m join adv_teams t on t.id = m.team_id where m.team_id = p_team and m.user_id = uid and m.status = 'invited' and t.status = 'active') then
    raise exception 'not_found';
  end if;
  if p_accept then
    update adv_team_members set status = 'active', joined_at = now() where team_id = p_team and user_id = uid;
    insert into adv_team_messages (team_id, user_id, kind, body) values (p_team, uid, 'text', 'joined the team 👋');
  else
    update adv_team_members set status = 'declined' where team_id = p_team and user_id = uid;
  end if;
end $$;

create or replace function public.adv_team_leave(p_team uuid) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); next_owner uuid;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from adv_team_members where team_id = p_team and user_id = uid and status = 'active') then raise exception 'not_found'; end if;
  delete from adv_team_members where team_id = p_team and user_id = uid;
  update adv_players set active_team = null where user_id = uid and active_team = p_team;
  select user_id into next_owner from adv_team_members where team_id = p_team and status = 'active' order by joined_at limit 1;
  if next_owner is null then update adv_teams set status = 'disbanded' where id = p_team and status = 'active';
  else update adv_teams set owner_id = next_owner where id = p_team and owner_id = uid; end if;
end $$;

create or replace function public.adv_team_detail(p_team uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); t adv_teams%rowtype; p adv_professions%rowtype; st text;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select * into t from adv_teams where id = p_team and status <> 'disbanded';
  if not found then raise exception 'not_found'; end if;
  select status into st from adv_team_members where team_id = p_team and user_id = uid;
  if st is null or st = 'declined' then raise exception 'not_found'; end if;
  select * into p from adv_professions where id = t.profession_id;
  return jsonb_build_object(
    'team', jsonb_build_object('id', t.id, 'name', t.name, 'status', t.status, 'owner_id', t.owner_id),
    'me', jsonb_build_object('id', uid, 'status', st),
    'profession', jsonb_build_object('slug', p.slug, 'name', p.name, 'emoji', p.emoji, 'color', p.color),
    'total', (select count(*) from adv_objects o where o.profession_id = p.id and o.active),
    'found', (select count(*) from adv_team_finds f join adv_objects o on o.id = f.object_id where f.team_id = t.id and o.active),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', pr.id, 'username', pr.username, 'display_name', pr.display_name, 'avatar_style', pr.avatar_style,
          'avatar_color', pr.avatar_color, 'avatar_url', pr.avatar_url, 'status', m.status,
          'found', (select count(*) from adv_team_finds f where f.team_id = t.id and f.user_id = pr.id)) order by m.joined_at nulls last)
        from adv_team_members m join profiles pr on pr.id = m.user_id where m.team_id = t.id and m.status in ('active','invited')), '[]'::jsonb),
    'objects', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'found', f.object_id is not null,
          'name', case when f.object_id is not null then o.name end, 'emoji', case when f.object_id is not null then o.emoji end,
          'image_path', case when f.object_id is not null then o.image_path end, 'by', pr.username, 'found_at', f.found_at) order by o.sort_order)
        from adv_objects o left join adv_team_finds f on f.object_id = o.id and f.team_id = t.id left join profiles pr on pr.id = f.user_id
       where o.profession_id = p.id and o.active), '[]'::jsonb),
    'playing', exists (select 1 from adv_players pl where pl.user_id = uid and pl.active_team = t.id));
end $$;

create or replace function public.adv_team_messages_get(p_team uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); last bigint;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from adv_team_members where team_id = p_team and user_id = uid and status = 'active') then raise exception 'not_found'; end if;
  select max(id) into last from adv_team_messages where team_id = p_team;
  insert into adv_team_reads (team_id, user_id, last_id) values (p_team, uid, coalesce(last, 0))
    on conflict (team_id, user_id) do update set last_id = excluded.last_id;
  return coalesce((select jsonb_agg(x order by (x->>'id')::bigint) from (
      select jsonb_build_object('id', g.id, 'kind', g.kind, 'body', g.body, 'created_at', g.created_at, 'mine', g.user_id = uid,
                                'user', jsonb_build_object('username', pr.username, 'display_name', pr.display_name, 'avatar_style', pr.avatar_style,
                                                           'avatar_color', pr.avatar_color, 'avatar_url', pr.avatar_url)) x
        from adv_team_messages g left join profiles pr on pr.id = g.user_id where g.team_id = p_team order by g.id desc limit 100) q), '[]'::jsonb);
end $$;

create or replace function public.adv_team_send(p_team uuid, p_body text) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b text := trim(p_body);
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  perform public.check_rate_limit('adv_chat', 40, interval '10 minutes');
  if not exists (select 1 from adv_team_members m join adv_teams t on t.id = m.team_id where m.team_id = p_team and m.user_id = uid and m.status = 'active' and t.status <> 'disbanded') then
    raise exception 'not_found';
  end if;
  if char_length(coalesce(b, '')) < 1 or char_length(b) > 500 then raise exception 'invalid_length'; end if;
  perform public.screen_text(b);
  insert into adv_team_messages (team_id, user_id, kind, body) values (p_team, uid, 'text', b);
end $$;

-- ---------- admin ----------
create or replace function public.adv_admin_list() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_found'; end if;
  return jsonb_build_object(
    'professions', coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('objects', coalesce((
        select jsonb_agg(to_jsonb(o) || jsonb_build_object('riddle', (select to_jsonb(r) from adv_riddles r where r.object_id = o.id)) order by o.sort_order, o.name)
          from adv_objects o where o.profession_id = p.id), '[]'::jsonb)) order by p.sort_order, p.name) from adv_professions p), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order) from adv_milestones m), '[]'::jsonb),
    'stats', jsonb_build_object('players', (select count(*) from adv_players), 'finds', (select count(*) from adv_finds), 'teams', (select count(*) from adv_teams where status <> 'disbanded')));
end $$;

create or replace function public.adv_admin_profession(p jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid := nullif(p->>'id', '')::uuid;
begin
  if not public.is_admin() then raise exception 'not_found'; end if;
  if pid is null then
    insert into adv_professions (slug, name, emoji, color, blurb, sort_order, active, starts_at, ends_at)
    values (lower(trim(p->>'slug')), trim(p->>'name'), coalesce(nullif(p->>'emoji', ''), '🎯'), coalesce(nullif(p->>'color', ''), '#F2573F'), nullif(trim(p->>'blurb'), ''),
            coalesce((p->>'sort_order')::int, 0), coalesce((p->>'active')::boolean, true), nullif(p->>'starts_at', '')::timestamptz, nullif(p->>'ends_at', '')::timestamptz)
    returning id into pid;
  else
    update adv_professions set slug = lower(trim(p->>'slug')), name = trim(p->>'name'), emoji = coalesce(nullif(p->>'emoji', ''), emoji), color = coalesce(nullif(p->>'color', ''), color),
      blurb = nullif(trim(p->>'blurb'), ''), sort_order = coalesce((p->>'sort_order')::int, sort_order), active = coalesce((p->>'active')::boolean, active),
      starts_at = nullif(p->>'starts_at', '')::timestamptz, ends_at = nullif(p->>'ends_at', '')::timestamptz where id = pid;
  end if;
  return pid;
end $$;

create or replace function public.adv_admin_delete_profession(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_found'; end if;
  delete from adv_professions where id = p_id;
end $$;

-- One call saves an object and, optionally, its riddle (kind riddle/silhouette/direct). A blank prompt removes the riddle.
create or replace function public.adv_admin_object(o jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare oid uuid := nullif(o->>'id', '')::uuid; ans text[];
begin
  if not public.is_admin() then raise exception 'not_found'; end if;
  if oid is null then
    insert into adv_objects (profession_id, name, emoji, image_path, rarity, area, section, placement, tile_x, tile_y, visibility, per_player, sort_order, active)
    values ((o->>'profession_id')::uuid, trim(o->>'name'), coalesce(nullif(o->>'emoji', ''), '❓'), nullif(o->>'image_path', ''), coalesce(nullif(o->>'rarity', ''), 'common'),
            coalesce(nullif(o->>'area', ''), 'main'), coalesce((o->>'section')::int, 0), coalesce(nullif(o->>'placement', ''), 'corridor'),
            nullif(o->>'tile_x', '')::int, nullif(o->>'tile_y', '')::int, coalesce(nullif(o->>'visibility', ''), 'clear'), coalesce((o->>'per_player')::boolean, false),
            coalesce((o->>'sort_order')::int, 0), coalesce((o->>'active')::boolean, true)) returning id into oid;
  else
    update adv_objects set profession_id = (o->>'profession_id')::uuid, name = trim(o->>'name'), emoji = coalesce(nullif(o->>'emoji', ''), emoji),
      image_path = nullif(o->>'image_path', ''), rarity = coalesce(nullif(o->>'rarity', ''), rarity), area = coalesce(nullif(o->>'area', ''), area),
      section = coalesce((o->>'section')::int, section), placement = coalesce(nullif(o->>'placement', ''), placement),
      tile_x = nullif(o->>'tile_x', '')::int, tile_y = nullif(o->>'tile_y', '')::int, visibility = coalesce(nullif(o->>'visibility', ''), visibility),
      per_player = coalesce((o->>'per_player')::boolean, per_player), sort_order = coalesce((o->>'sort_order')::int, sort_order),
      active = coalesce((o->>'active')::boolean, active) where id = oid;
  end if;
  if coalesce(trim(o->>'riddle_prompt'), '') = '' then
    delete from adv_riddles where object_id = oid;
  else
    ans := array(select trim(x) from unnest(string_to_array(coalesce(o->>'riddle_answers', ''), ',')) x where trim(x) <> '');
    insert into adv_riddles (object_id, kind, prompt, hint, difficulty, answers, active)
    values (oid, coalesce(nullif(o->>'riddle_kind', ''), 'riddle'), trim(o->>'riddle_prompt'), nullif(trim(o->>'riddle_hint'), ''), coalesce((o->>'riddle_difficulty')::int, 1), ans, true)
    on conflict (object_id) do update set kind = excluded.kind, prompt = excluded.prompt, hint = excluded.hint, difficulty = excluded.difficulty, answers = excluded.answers;
  end if;
  return oid;
end $$;

create or replace function public.adv_admin_delete_object(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_found'; end if;
  delete from adv_objects where id = p_id;
end $$;

create or replace function public.adv_admin_milestone(m jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid := nullif(m->>'id', '')::uuid;
begin
  if not public.is_admin() then raise exception 'not_found'; end if;
  if mid is null then
    insert into adv_milestones (slug, title, description, icon, color, metric, threshold, reward, sort_order, active)
    values (lower(trim(m->>'slug')), trim(m->>'title'), coalesce(m->>'description', ''), coalesce(nullif(m->>'icon', ''), '★'), coalesce(nullif(m->>'color', ''), '#F7B538'),
            m->>'metric', (m->>'threshold')::int, coalesce(nullif(m->>'reward', ''), 'badge'), coalesce((m->>'sort_order')::int, 0), coalesce((m->>'active')::boolean, true)) returning id into mid;
  else
    update adv_milestones set slug = lower(trim(m->>'slug')), title = trim(m->>'title'), description = coalesce(m->>'description', description), icon = coalesce(nullif(m->>'icon', ''), icon),
      color = coalesce(nullif(m->>'color', ''), color), metric = m->>'metric', threshold = (m->>'threshold')::int, reward = coalesce(nullif(m->>'reward', ''), reward),
      sort_order = coalesce((m->>'sort_order')::int, sort_order), active = coalesce((m->>'active')::boolean, active) where id = mid;
  end if;
  return mid;
end $$;

create or replace function public.adv_admin_delete_milestone(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_found'; end if;
  delete from adv_milestones where id = p_id;
end $$;

-- ---------- storage for object illustrations ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adventure', 'adventure', true, 1048576, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;
create policy adventure_read on storage.objects for select to anon, authenticated using (bucket_id = 'adventure');
create policy adventure_admin_write on storage.objects for insert to authenticated with check (bucket_id = 'adventure' and public.is_admin());
create policy adventure_admin_update on storage.objects for update to authenticated using (bucket_id = 'adventure' and public.is_admin());
create policy adventure_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'adventure' and public.is_admin());

-- ---------- permissions ----------
do $$ declare f text; begin
  foreach f in array array[
    'adv_join(text,uuid)','adv_pause()','adv_answer(uuid,text)','adv_collect(uuid,uuid)','adv_maze(text)','adv_overview()','adv_collection(text,uuid)','adv_book()','adv_rewards()',
    'adv_friends(uuid)','adv_team_create(text,text,uuid[])','adv_team_invite(uuid,uuid[])','adv_team_respond(uuid,boolean)','adv_team_leave(uuid)','adv_team_detail(uuid)',
    'adv_team_messages_get(uuid)','adv_team_send(uuid,text)','adv_admin_list()','adv_admin_profession(jsonb)','adv_admin_delete_profession(uuid)','adv_admin_object(jsonb)',
    'adv_admin_delete_object(uuid)','adv_admin_milestone(jsonb)','adv_admin_delete_milestone(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- readable by anyone, so profiles and reaction lists work for signed-out visitors
  execute 'revoke all on function public.adv_profile(uuid) from public';
  execute 'grant execute on function public.adv_profile(uuid) to anon, authenticated';
  execute 'revoke all on function public.fire_reactors(text,uuid) from public';
  execute 'grant execute on function public.fire_reactors(text,uuid) to anon, authenticated';
  -- internal helpers are not callable from the browser
  foreach f in array array['adv_norm(text)','adv_open(adv_professions)','adv_unlocked(uuid,uuid)','adv_metric(uuid,text)','adv_xp(uuid)','adv_award(uuid)','adv_has_fire(uuid)','adv_progress(uuid)','adv_invite_one(uuid,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- FALSE WALLS 0005: permissions helpers, safety helpers, notifications, badges, ranking

alter table public.profiles add constraint avatar_url_owned
  check (avatar_url is null or avatar_url like id::text || '/%');

create table public.poll_votes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  option_idx int not null check (option_idx between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create unique index posts_one_response_per_prompt on public.posts (author_id, prompt_id)
  where type = 'prompt_response' and status <> 'removed';

-- ---------- relationship helpers ----------
create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks
    where kind = 'block' and ((blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)));
$$;

create or replace function public.is_following(f uuid, t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from follows where follower_id = f and followee_id = t);
$$;

create or replace function public.is_muted_by(viewer uuid, other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where blocker_id = viewer and blocked_id = other and kind = 'mute');
$$;

-- Row-level visibility rule for a post, used by policies and functions.
create or replace function public.post_visible(p_author uuid, p_visibility text, p_status text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or (p_author is not null and p_author = auth.uid())
    or (
      p_status = 'active'
      and (p_author is null or exists (select 1 from profiles a where a.id = p_author and a.status = 'active'))
      and not public.is_blocked_between(auth.uid(), p_author)
      and not public.is_muted_by(auth.uid(), p_author)
      and (
        p_visibility = 'public'
        or (p_visibility = 'followers' and auth.uid() is not null and public.is_following(auth.uid(), p_author))
      )
    );
$$;

create or replace function public.can_view_post(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.post_visible(p.author_id, p.visibility, p.status) from posts p where p.id = p_id), false);
$$;

create or replace function public.can_reveal_post(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.can_view_post(p.id) and (
      p.reveal_mode = 'anyone' or p.author_id = auth.uid() or public.is_staff()
      or public.is_following(auth.uid(), p.author_id)
    ) from posts p where p.id = p_id), false);
$$;

create or replace function public.can_view_target(p_type text, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_type
    when 'post' then public.can_view_post(p_id)
    when 'answer' then coalesce((select a.status = 'active' and (a.is_public or a.author_id = auth.uid()) and public.can_view_post(a.post_id)
                                 from answers a where a.id = p_id), false)
    when 'reply' then coalesce((select r.status = 'active' and public.can_view_post(r.post_id) and not public.is_blocked_between(auth.uid(), r.author_id)
                                from replies r where r.id = p_id), false)
    else false end;
$$;

create or replace function public.can_follow(p_target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_target <> auth.uid()
    and public.is_member()
    and not public.is_blocked_between(auth.uid(), p_target)
    and coalesce((select allow_follows from user_settings where user_id = p_target), false)
    and exists (select 1 from profiles where id = p_target and status = 'active');
$$;

-- ---------- safety helpers ----------
create or replace function public.check_rate_limit(p_action text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select count(*) into n from rate_limit_events
    where user_id = uid and action = p_action and created_at > now() - p_window;
  if n >= p_max then raise exception 'rate_limited'; end if;
  insert into rate_limit_events (user_id, action) values (uid, p_action);
  if random() < 0.02 then
    delete from rate_limit_events where created_at < now() - interval '2 days';
  end if;
end $$;

create or replace function public.term_severity(t text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(severity), 0) from blocked_terms
  where lower(coalesce(t, '')) ~ ('\m' || regexp_replace(term, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M');
$$;

-- Raises on contact info, spam patterns or severe terms; returns 1 when text should be queued for review.
create or replace function public.screen_text(variadic texts text[]) returns int
language plpgsql stable security definer set search_path = public as $$
declare t text; sev int := 0; s int;
begin
  foreach t in array texts loop
    if t is null or t = '' then continue; end if;
    if public.has_contact_info(t) then raise exception 'contact_info'; end if;
    if (select count(*) from regexp_matches(t, '(https?://|www\.)', 'gi')) > 1 then raise exception 'too_many_links'; end if;
    if t ~ '(.)\1{14,}' then raise exception 'spam_pattern'; end if;
    s := public.term_severity(t);
    if s >= 2 then raise exception 'content_not_allowed'; end if;
    sev := greatest(sev, s);
  end loop;
  return sev;
end $$;

create or replace function public.auto_flag(p_type text, p_id uuid, p_reason text default 'other') returns void
language sql security definer set search_path = public as $$
  insert into reports (reporter_id, source, target_type, target_id, reason, priority)
  values (null, 'auto', p_type, p_id, p_reason, 1);
$$;

-- ---------- notifications ----------
create or replace function public.notify(p_user uuid, p_kind text, p_actor uuid, p_post uuid, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s user_settings%rowtype; pref boolean;
begin
  if p_user is null or p_user is not distinct from p_actor then return; end if;
  select * into s from user_settings where user_id = p_user;
  if not found then return; end if;
  pref := case p_kind
    when 'question' then s.notify_questions when 'answer' then s.notify_answers
    when 'reply' then s.notify_replies when 'reaction' then s.notify_reactions
    when 'follow' then s.notify_follows when 'chain' then s.notify_chains
    when 'badge' then s.notify_badges when 'discovery' then s.notify_discoveries else true end;
  if not pref then return; end if;
  if p_actor is not null and exists (
    select 1 from blocks b where (b.blocker_id = p_user and b.blocked_id = p_actor)
       or (b.kind = 'block' and b.blocker_id = p_actor and b.blocked_id = p_user)) then return; end if;
  if p_kind in ('reaction','reply') and exists (
    select 1 from notifications n where n.user_id = p_user and n.kind = p_kind
      and n.post_id is not distinct from p_post and n.read_at is null
      and n.created_at > now() - interval '1 hour') then return; end if;
  insert into notifications (user_id, kind, actor_id, post_id, data) values (p_user, p_kind, p_actor, p_post, p_data);
end $$;

-- ---------- badges ----------
create or replace function public.award_badges(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b badges%rowtype; n int;
begin
  for b in select * from badges where active loop
    if exists (select 1 from user_badges where user_id = p_user and badge_slug = b.slug) then continue; end if;
    n := case b.rule
      when 'walls_explored' then (select count(*) from discoveries where user_id = p_user and kind = 'wall_explored')
      when 'reveals' then (select count(*) from discoveries where user_id = p_user and kind = 'false_wall_revealed')
      when 'areas_visited' then (select count(*) from discoveries where user_id = p_user and kind = 'area_visited')
      when 'conversations_started' then (
        -- Posts that drew at least 3 replies from at least 2 different other people.
        select count(*) from posts p where p.author_id = p_user and p.status = 'active' and (
          select count(*) from replies r where r.post_id = p.id and r.status = 'active' and r.author_id <> p_user) >= 3
          and (select count(distinct r.author_id) from replies r where r.post_id = p.id and r.status = 'active' and r.author_id <> p_user) >= 2)
      when 'early_finds' then (
        -- Reactions made within 6 hours of posting on posts that later drew 8+ other people.
        select count(*) from reactions x join posts p on p.id = x.target_id and x.target_type = 'post'
        where x.user_id = p_user and p.author_id is distinct from p_user
          and x.created_at < p.created_at + interval '6 hours'
          and (select count(distinct y.user_id) from reactions y
               where y.target_type = 'post' and y.target_id = p.id and y.user_id is distinct from p.author_id) >= 8)
      else 0 end;
    if n >= b.threshold then
      insert into user_badges (user_id, badge_slug) values (p_user, b.slug) on conflict do nothing;
      perform public.notify(p_user, 'badge', null, null, jsonb_build_object('badge', b.slug, 'name', b.name));
    end if;
  end loop;
end $$;

-- ---------- onboarding ----------
create or replace function public.complete_onboarding(
  p_username text, p_display_name text, p_avatar_style text, p_avatar_color text,
  p_avatar_url text, p_bio text, p_interests text[], p_birth_date date
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); yrs int; grp text; uname text := lower(trim(p_username));
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from profiles where id = uid) then raise exception 'already_onboarded'; end if;
  if p_birth_date is null or p_birth_date > current_date then raise exception 'invalid_birth_date'; end if;
  yrs := extract(year from age(current_date, p_birth_date));
  if yrs > 120 then raise exception 'invalid_birth_date'; end if;
  if yrs < 13 then raise exception 'under_age'; end if;
  grp := case when yrs < 18 then 'teen' else 'adult' end;
  if uname in ('admin','administrator','moderator','mod','falsewalls','false_walls','support','staff','system','official','root') then
    raise exception 'username_reserved';
  end if;
  perform public.screen_text(uname, p_display_name, p_bio);
  begin
    insert into profiles (id, username, display_name, avatar_style, avatar_color, avatar_url, age_group)
    values (uid, uname, nullif(trim(p_display_name), ''), coalesce(p_avatar_style, 'blob'),
            coalesce(p_avatar_color, '#FF6B4A'), p_avatar_url, grp);
  exception when unique_violation then raise exception 'username_taken';
  end;
  insert into profile_details (user_id, bio, interests)
    values (uid, nullif(trim(p_bio), ''), coalesce((select array_agg(i) from (select distinct lower(trim(x)) i from unnest(p_interests) x where trim(x) <> '' limit 8) q), '{}'));
  -- Teen accounts start private: no anonymous questions, not listed in search, bio hidden.
  insert into user_settings (user_id, profile_public, discoverable, allow_anonymous_questions)
    values (uid, grp = 'adult', grp = 'adult', grp = 'adult');
  return uid;
end $$;

-- ---------- discovery ----------
create or replace function public.record_discovery(p_kind text, p_key text) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); added int;
begin
  if uid is null or not public.is_member() then return false; end if;
  if p_kind = 'wall_explored' then
    if not public.can_view_post(p_key::uuid) then return false; end if;
    if exists (select 1 from posts where id = p_key::uuid and author_id = uid) then return false; end if;
  elsif p_kind = 'false_wall_revealed' then
    -- Only recorded by reveal_post, after permission checks and a stored reveal.
    if not exists (select 1 from post_reveals where user_id = uid and post_id = p_key::uuid) then return false; end if;
  elsif p_kind = 'area_visited' then
    if not exists (select 1 from maze_areas where slug = p_key) then return false; end if;
  elsif p_kind = 'door_found' then
    if p_key !~ '^[a-z]+>[a-z]+$' then return false; end if;
  elsif p_kind = 'chain_explored' then
    if not exists (select 1 from wall_chains c where c.id = p_key::uuid and public.can_view_post(c.root_post_id)) then return false; end if;
  else
    return false;
  end if;
  -- Throttle new discoveries so scripted opening cannot farm progress.
  if (select count(*) from discoveries where user_id = uid and created_at > now() - interval '10 minutes') >= 40 then
    return false;
  end if;
  insert into discoveries (user_id, kind, target_key) values (uid, p_kind, p_key) on conflict do nothing;
  get diagnostics added = row_count;
  if added > 0 then perform public.award_badges(uid); end if;
  return added > 0;
end $$;

create or replace function public.reveal_post(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sec post_secrets%rowtype; media jsonb; p posts%rowtype;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select * into p from posts where id = p_id;
  if not found or not public.can_view_post(p_id) then raise exception 'not_found'; end if;
  if not public.can_reveal_post(p_id) then raise exception 'followers_only'; end if;
  perform public.check_rate_limit('reveal', 120, interval '1 hour');
  select * into sec from post_secrets where post_id = p_id;
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'storage_path', m.storage_path,
           'width', m.width, 'height', m.height, 'alt_text', m.alt_text)), '[]'::jsonb)
    into media from post_media m where m.post_id = p_id and m.is_hidden;
  if p.author_id is distinct from uid then
    insert into post_reveals (user_id, post_id) values (uid, p_id) on conflict do nothing;
    perform public.record_discovery('false_wall_revealed', p_id::text);
  end if;
  return jsonb_build_object('hidden_text', sec.hidden_text, 'payload', coalesce(sec.payload, '{}'::jsonb), 'media', media);
end $$;

create or replace function public.vote_poll(p_post uuid, p_idx int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); opts jsonb;
begin
  if not public.is_member() then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from post_reveals where user_id = uid and post_id = p_post)
     and not exists (select 1 from posts where id = p_post and author_id = uid) then raise exception 'reveal_first'; end if;
  select payload->'options' into opts from post_secrets where post_id = p_post;
  if opts is null or p_idx < 0 or p_idx >= jsonb_array_length(opts) then raise exception 'invalid_option'; end if;
  perform public.check_rate_limit('vote', 60, interval '1 hour');
  insert into poll_votes (post_id, user_id, option_idx) values (p_post, uid, p_idx)
    on conflict (post_id, user_id) do update set option_idx = excluded.option_idx;
  return public.poll_results(p_post);
end $$;

create or replace function public.poll_results(p_post uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); opts jsonb;
begin
  if not exists (select 1 from post_reveals where user_id = uid and post_id = p_post)
     and not exists (select 1 from posts where id = p_post and author_id = uid) then return null; end if;
  select payload->'options' into opts from post_secrets where post_id = p_post;
  if opts is null then return null; end if;
  return jsonb_build_object(
    'mine', (select option_idx from poll_votes where post_id = p_post and user_id = uid),
    'counts', (select coalesce(jsonb_agg(c order by i), '[]'::jsonb) from (
        select g.i, (select count(*) from poll_votes v where v.post_id = p_post and v.option_idx = g.i) c
        from generate_series(0, jsonb_array_length(opts) - 1) g(i)) q));
end $$;

-- ---------- creating, editing posts ----------
create or replace function public.create_post(
  p_type text, p_title text, p_body text, p_clue text, p_prompt_id uuid,
  p_false_wall_kind text, p_clue_style text, p_wall_color text,
  p_visibility text, p_reveal_mode text, p_allow_anonymous boolean, p_allow_replies boolean, p_allow_chains boolean,
  p_area_slug text, p_hidden_text text, p_payload jsonb, p_media jsonb,
  p_chain_parent uuid default null, p_chain_answer uuid default null, p_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); pid uuid := coalesce(p_id, gen_random_uuid()); area text; allowed text[];
  sev int; slot int; m jsonb; parent posts%rowtype; chain uuid; media_n int := 0; settings user_settings%rowtype;
  anon boolean;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  perform public.check_rate_limit('create_post', 12, interval '1 hour');
  perform public.check_rate_limit('create_post_day', 40, interval '1 day');
  select * into settings from user_settings where user_id = uid;

  allowed := case p_type
    when 'ask_me' then array['question','main']
    when 'hidden_thought' then array['hidden','main']
    when 'picture' then array['picture','main']
    when 'prompt_response' then array['community','main']
    when 'false_wall' then array['main','hidden']
    else null end;
  if allowed is null then raise exception 'invalid_type'; end if;
  area := coalesce(p_area_slug, allowed[1]);
  if not area = any (allowed) then raise exception 'invalid_area'; end if;
  if p_visibility not in ('public','followers') then raise exception 'invalid_visibility'; end if;
  if p_reveal_mode not in ('anyone','followers') then raise exception 'invalid_reveal_mode'; end if;
  if p_media is not null and jsonb_typeof(p_media) <> 'array' then raise exception 'invalid_media'; end if;
  media_n := coalesce(jsonb_array_length(p_media), 0);
  if media_n > 4 then raise exception 'too_many_images'; end if;

  if p_type = 'ask_me' then
    if char_length(coalesce(trim(p_title), '')) < 3 then raise exception 'title_required'; end if;
  elsif p_type = 'hidden_thought' then
    if char_length(coalesce(trim(p_clue), '')) < 3 then raise exception 'clue_required'; end if;
    if char_length(coalesce(trim(p_hidden_text), '')) < 1 then raise exception 'hidden_required'; end if;
  elsif p_type = 'picture' then
    if media_n < 1 then raise exception 'image_required'; end if;
    if char_length(coalesce(trim(p_title), '')) < 3 then raise exception 'title_required'; end if;
  elsif p_type = 'prompt_response' then
    if p_prompt_id is null or not exists (select 1 from random_prompts where id = p_prompt_id and active) then raise exception 'prompt_required'; end if;
    if char_length(coalesce(trim(p_body), '')) < 3 then raise exception 'body_required'; end if;
  elsif p_type = 'false_wall' then
    if char_length(coalesce(trim(p_clue), '')) < 3 then raise exception 'clue_required'; end if;
    if p_false_wall_kind is null or p_clue_style is null then raise exception 'wall_style_required'; end if;
    if p_false_wall_kind = 'photo' and media_n < 1 then raise exception 'image_required'; end if;
    if p_false_wall_kind = 'poll' and (jsonb_typeof(p_payload->'options') <> 'array'
       or jsonb_array_length(p_payload->'options') not between 2 and 4) then raise exception 'poll_options'; end if;
    if p_false_wall_kind in ('question','story','conversation') and char_length(coalesce(trim(p_hidden_text), '')) < 1 then raise exception 'hidden_required'; end if;
  end if;

  sev := public.screen_text(p_title, p_body, p_clue, p_hidden_text, p_payload::text);
  if exists (select 1 from posts where author_id = uid and created_at > now() - interval '1 day'
             and lower(coalesce(title,'') || '|' || coalesce(body,'') || '|' || coalesce(clue,''))
               = lower(coalesce(trim(p_title),'') || '|' || coalesce(trim(p_body),'') || '|' || coalesce(trim(p_clue),''))) then
    raise exception 'duplicate';
  end if;

  anon := coalesce(p_allow_anonymous, true) and coalesce(settings.allow_anonymous_questions, false);

  insert into posts (id, author_id, type, title, body, clue, prompt_id, false_wall_kind, clue_style, wall_color,
                     visibility, reveal_mode, allow_anonymous_questions, allow_replies, allow_chains, area_slug)
  values (pid, uid, p_type, nullif(trim(p_title), ''), nullif(trim(p_body), ''), nullif(trim(p_clue), ''), p_prompt_id,
          p_false_wall_kind, p_clue_style, coalesce(p_wall_color, 'coral'), p_visibility, p_reveal_mode, anon,
          coalesce(p_allow_replies, true), coalesce(p_allow_chains, true), area);

  if p_hidden_text is not null or p_payload is not null then
    insert into post_secrets (post_id, hidden_text, payload)
    values (pid, nullif(trim(p_hidden_text), ''), coalesce(p_payload, '{}'::jsonb));
  end if;

  for m in select * from jsonb_array_elements(coalesce(p_media, '[]'::jsonb)) loop
    if (m->>'path') is null or (m->>'path') not like uid::text || '/' || pid::text || '/%' then raise exception 'invalid_media'; end if;
    insert into post_media (post_id, owner_id, storage_path, width, height, bytes, alt_text, is_hidden)
    values (pid, uid, m->>'path', nullif(m->>'width','')::int, nullif(m->>'height','')::int,
            nullif(m->>'bytes','')::int, left(m->>'alt', 200), p_type = 'false_wall');
  end loop;

  perform pg_advisory_xact_lock(hashtext('wall_slots:' || area));
  select coalesce(max(slot_index) + 1, 0) into slot from wall_locations where area_slug = area;
  insert into wall_locations (area_slug, slot_index, post_id) values (area, slot, pid);

  if p_chain_parent is not null then
    select * into parent from posts where id = p_chain_parent;
    if not found or not public.can_view_post(p_chain_parent) then raise exception 'chain_parent_unavailable'; end if;
    if not parent.allow_chains then raise exception 'chains_disabled'; end if;
    if parent.visibility = 'followers' and p_visibility = 'public' then raise exception 'chain_visibility'; end if;
    if p_chain_answer is not null and not exists (
      select 1 from answers a where a.id = p_chain_answer and a.post_id = p_chain_parent and a.status = 'active'
        and public.can_view_target('answer', a.id)) then raise exception 'chain_answer_invalid'; end if;
    select c.id into chain from wall_chains c where c.root_post_id = p_chain_parent;
    if chain is null then
      select l.chain_id into chain from wall_chain_links l where l.child_post_id = p_chain_parent;
    end if;
    if chain is null then
      insert into wall_chains (root_post_id) values (p_chain_parent) returning id into chain;
    end if;
    insert into wall_chain_links (chain_id, parent_post_id, child_post_id, via_answer_id, created_by)
    values (chain, p_chain_parent, pid, p_chain_answer, uid);
    perform public.notify(parent.author_id, 'chain', uid, pid, jsonb_build_object('parent', p_chain_parent));
  end if;

  if sev >= 1 then perform public.auto_flag('post', pid); end if;
  return pid;
end $$;

create or replace function public.edit_post(p_id uuid, p_title text, p_body text, p_clue text, p_hidden_text text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p posts%rowtype; sev int;
begin
  select * into p from posts where id = p_id and author_id = uid and status = 'active';
  if not found then raise exception 'not_found'; end if;
  if not public.is_member() then raise exception 'not_authenticated'; end if;
  perform public.check_rate_limit('edit_post', 30, interval '1 hour');
  sev := public.screen_text(p_title, p_body, p_clue, p_hidden_text);
  if p.type in ('ask_me','picture') and char_length(coalesce(trim(p_title), '')) < 3 then raise exception 'title_required'; end if;
  if p.type in ('hidden_thought','false_wall') and char_length(coalesce(trim(p_clue), '')) < 3 then raise exception 'clue_required'; end if;
  if p.type = 'prompt_response' and char_length(coalesce(trim(p_body), '')) < 3 then raise exception 'body_required'; end if;
  update posts set title = nullif(trim(p_title), ''), body = nullif(trim(p_body), ''), clue = nullif(trim(p_clue), '') where id = p_id;
  if p_hidden_text is not null then
    if char_length(trim(p_hidden_text)) < 1 and p.type = 'hidden_thought' then raise exception 'hidden_required'; end if;
    update post_secrets set hidden_text = nullif(trim(p_hidden_text), '') where post_id = p_id;
  end if;
  if sev >= 1 then perform public.auto_flag('post', p_id); end if;
end $$;

-- ---------- anonymous and identified questions ----------
create or replace function public.send_question(p_post uuid, p_body text, p_anonymous boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); p posts%rowtype; s user_settings%rowtype; qid uuid; shadow boolean := false; sev int;
  v_body text := trim(p_body);
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select * into p from posts where id = p_post;
  if not found or p.is_sample or p.author_id is null or p.status <> 'active' then raise exception 'not_askable'; end if;
  if not public.can_view_post(p_post) then raise exception 'not_found'; end if;
  if p.author_id = uid then raise exception 'own_post'; end if;
  select * into s from user_settings where user_id = p.author_id;
  if p_anonymous and not (p.allow_anonymous_questions and s.allow_anonymous_questions) then raise exception 'anonymous_disabled'; end if;
  if not p_anonymous and not s.allow_identified_questions then raise exception 'identified_disabled'; end if;
  -- Anonymous questions to teens are only accepted from other teens.
  if p_anonymous and public.is_teen(p.author_id) and not public.is_teen(uid) then raise exception 'anonymous_disabled'; end if;
  if char_length(coalesce(v_body, '')) < 1 or char_length(v_body) > 500 then raise exception 'invalid_length'; end if;

  perform public.check_rate_limit('send_question', 15, interval '1 hour');
  perform public.check_rate_limit('send_question_day', 60, interval '1 day');
  -- Per-recipient limits stop repeated unwanted messages, anonymous or not.
  if (select count(*) from questions q left join question_senders qs on qs.question_id = q.id
      where q.recipient_id = p.author_id and (q.asker_id = uid or qs.sender_id = uid)
        and q.created_at > now() - interval '1 day') >= 5 then raise exception 'too_many_to_recipient'; end if;
  if exists (select 1 from questions q left join question_senders qs on qs.question_id = q.id
      where q.recipient_id = p.author_id and (q.asker_id = uid or qs.sender_id = uid)
        and lower(q.body) = lower(v_body) and q.created_at > now() - interval '7 days') then raise exception 'duplicate'; end if;
  -- Attempts to unmask senders are not allowed.
  if v_body ~* '(who (are|r) you|reveal (yourself|your name)|i will (find|track) you|i know who you are|doxx?)' then
    raise exception 'content_not_allowed';
  end if;
  sev := public.screen_text(v_body);

  -- Blocked senders are silently dropped so a block never reveals itself.
  if exists (select 1 from blocks where blocker_id = p.author_id and blocked_id = uid) then shadow := true; end if;

  insert into questions (post_id, recipient_id, asker_id, is_anonymous, body, status)
  values (p_post, p.author_id, case when p_anonymous then null else uid end, p_anonymous, v_body,
          case when shadow then 'rejected' else 'pending' end)
  returning id into qid;
  if p_anonymous then insert into question_senders (question_id, sender_id) values (qid, uid); end if;
  if sev >= 1 then perform public.auto_flag('question', qid); end if;
  if not shadow then
    perform public.notify(p.author_id, 'question', case when p_anonymous then null else uid end, p_post,
                          jsonb_build_object('question_id', qid, 'anonymous', p_anonymous));
  end if;
  return qid;
end $$;

create or replace function public.answer_question(p_question uuid, p_body text, p_public boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); q questions%rowtype; aid uuid; sender uuid;
begin
  select * into q from questions where id = p_question and recipient_id = uid and status = 'pending';
  if not found or not public.is_member() then raise exception 'not_found'; end if;
  if char_length(coalesce(trim(p_body), '')) < 1 or char_length(trim(p_body)) > 1000 then raise exception 'invalid_length'; end if;
  perform public.check_rate_limit('answer', 60, interval '1 hour');
  perform public.screen_text(p_body);
  insert into answers (question_id, post_id, author_id, asker_id, question_text, body, is_public)
  values (q.id, q.post_id, uid, q.asker_id, q.body, trim(p_body), coalesce(p_public, false))
  returning id into aid;
  update questions set status = 'answered' where id = q.id;
  select sender_id into sender from question_senders where question_id = q.id;
  perform public.notify(coalesce(q.asker_id, sender), 'answer', uid, q.post_id, jsonb_build_object('answer_id', aid));
  return aid;
end $$;

create or replace function public.set_answer_public(p_answer uuid, p_public boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update answers set is_public = p_public where id = p_answer and author_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
end $$;

create or replace function public.reject_question(p_question uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update questions set status = 'rejected' where id = p_question and recipient_id = auth.uid() and status = 'pending';
  if not found then raise exception 'not_found'; end if;
end $$;

create or replace function public.delete_question(p_question uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update questions set status = 'deleted' where id = p_question and recipient_id = auth.uid() and status <> 'deleted';
  if not found then raise exception 'not_found'; end if;
end $$;

-- Block whoever sent a question, anonymous or not, without ever showing their identity.
create or replace function public.block_question_sender(p_question uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); q questions%rowtype; sender uuid;
begin
  select * into q from questions where id = p_question and recipient_id = uid;
  if not found then raise exception 'not_found'; end if;
  select coalesce(q.asker_id, (select sender_id from question_senders where question_id = q.id)) into sender;
  if sender is null or sender = uid then raise exception 'not_found'; end if;
  insert into blocks (blocker_id, blocked_id, kind, hidden_identity) values (uid, sender, 'block', q.asker_id is null)
    on conflict (blocker_id, blocked_id) do update set kind = 'block';
  update questions set status = 'rejected' where recipient_id = uid and status = 'pending'
    and (asker_id = sender or id in (select question_id from question_senders where sender_id = sender));
end $$;

-- ---------- replies and reactions ----------
create or replace function public.post_reply(p_post uuid, p_body text, p_answer uuid default null, p_parent uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p posts%rowtype; rid uuid; sev int; v_body text := trim(p_body); parent_author uuid;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select * into p from posts where id = p_post;
  if not found or not public.can_view_post(p_post) then raise exception 'not_found'; end if;
  if p.status <> 'active' or not p.allow_replies then raise exception 'replies_disabled'; end if;
  if char_length(coalesce(v_body, '')) < 1 or char_length(v_body) > 600 then raise exception 'invalid_length'; end if;
  if p_answer is not null and not exists (select 1 from answers where id = p_answer and post_id = p_post and status = 'active') then raise exception 'not_found'; end if;
  if p_parent is not null then
    select author_id into parent_author from replies where id = p_parent and post_id = p_post and status = 'active';
    if parent_author is null then raise exception 'not_found'; end if;
    if public.is_blocked_between(uid, parent_author) then raise exception 'not_found'; end if;
  end if;
  perform public.check_rate_limit('reply', 40, interval '1 hour');
  if exists (select 1 from replies where author_id = uid and lower(v_body) = lower(v_body)
             and created_at > now() - interval '1 day') then raise exception 'duplicate'; end if;
  sev := public.screen_text(v_body);
  insert into replies (post_id, answer_id, parent_reply_id, author_id, body)
  values (p_post, p_answer, p_parent, uid, v_body) returning id into rid;
  if sev >= 1 then perform public.auto_flag('reply', rid); end if;
  perform public.notify(p.author_id, 'reply', uid, p_post, jsonb_build_object('reply_id', rid));
  if parent_author is not null then
    perform public.notify(parent_author, 'reply', uid, p_post, jsonb_build_object('reply_id', rid));
  end if;
  return rid;
end $$;

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
  if p_kind not in ('interesting','funny','surprising','thought_provoking','like') then raise exception 'invalid_reaction'; end if;
  perform public.check_rate_limit('react', 120, interval '1 hour');
  insert into reactions (user_id, target_type, target_id, kind) values (uid, p_type, p_id, p_kind)
    on conflict (user_id, target_type, target_id) do update set kind = excluded.kind;
  perform public.notify(owner, 'reaction', uid, pid, jsonb_build_object('target_type', p_type, 'kind', p_kind));
  perform public.award_badges(uid);
end $$;

-- ---------- reporting ----------
create or replace function public.report_content(p_type text, p_id uuid, p_reason text, p_details text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prio int; allowed boolean := false;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  allowed := case p_type
    when 'user' then exists (select 1 from profiles where id = p_id and id <> uid)
    when 'question' then exists (select 1 from questions where id = p_id and recipient_id = uid)
    else public.can_view_target(p_type, p_id) end;
  if not allowed then raise exception 'not_found'; end if;
  perform public.check_rate_limit('report', 30, interval '1 day');
  prio := case p_reason when 'minor_safety' then 3 when 'threat' then 3 when 'self_harm' then 3
                        when 'sexual_content' then 2 when 'harassment' then 2 when 'privacy' then 2 else 1 end;
  insert into reports (reporter_id, target_type, target_id, reason, details, priority)
  values (uid, p_type, p_id, p_reason, left(p_details, 500), prio)
  on conflict do nothing;
end $$;

-- Several independent reports from established accounts hide a post until staff review it.
create or replace function public.reports_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.target_type not in ('post','answer','reply') or new.reporter_id is null then return new; end if;
  select count(distinct r.reporter_id) into n from reports r join profiles pr on pr.id = r.reporter_id
    where r.target_type = new.target_type and r.target_id = new.target_id and r.status = 'open'
      and pr.created_at < now() - interval '1 day';
  if n >= 5 then
    if new.target_type = 'post' then update posts set status = 'hidden' where id = new.target_id and status = 'active';
    elsif new.target_type = 'answer' then update answers set status = 'removed' where id = new.target_id;
    else update replies set status = 'removed' where id = new.target_id; end if;
  end if;
  return new;
end $$;
create trigger reports_after_insert_trg after insert on public.reports
  for each row execute function public.reports_after_insert();

-- ---------- follow / block triggers ----------
create or replace function public.follows_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_rate_limit('follow', 60, interval '1 hour');
  return new;
end $$;
create trigger follows_before_insert_trg before insert on public.follows
  for each row execute function public.follows_before_insert();

create or replace function public.follows_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.followee_id, 'follow', new.follower_id, null, '{}'::jsonb);
  return new;
end $$;
create trigger follows_after_insert_trg after insert on public.follows
  for each row execute function public.follows_after_insert();

create or replace function public.blocks_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'block' then
    delete from follows where (follower_id = new.blocker_id and followee_id = new.blocked_id)
                           or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  end if;
  return new;
end $$;
create trigger blocks_after_insert_trg after insert on public.blocks
  for each row execute function public.blocks_after_insert();

-- ---------- ranking (SECURITY INVOKER: only rows the caller may see are ranked) ----------
create or replace function public.trending_posts(p_limit int default 30, p_offset int default 0, p_area text default null, p_type text default null)
returns table (post_id uuid, score numeric, engaged_users int)
language sql stable security definer set search_path = public as $$
  with cand as (
    select p.id, p.author_id, p.created_at, p.type,
           char_length(coalesce(p.title,'') || coalesce(p.body,'') || coalesce(p.clue,'')) as len
    from posts p
    where p.status = 'active' and p.created_at > now() - interval '14 days'
      and public.post_visible(p.author_id, p.visibility, p.status)
      and (p_area is null or p.area_slug = p_area)
      and (p_type is null or p.type = p_type)
      and not exists (select 1 from trending_overrides o where o.post_id = p.id and o.suppressed)
      -- Content with serious open reports never trends.
      and not exists (select 1 from reports r where r.target_type = 'post' and r.target_id = p.id
                        and r.status = 'open' and r.priority >= 2)
  ),
  rx as (
    select c.id as post_id, x.user_id,
      case x.kind when 'thought_provoking' then 1.5 when 'interesting' then 1.2 when 'surprising' then 1.2
                  when 'funny' then 1.0 else 0.6 end
        * case when x.created_at > now() - interval '24 hours' then 1.5 else 1.0 end as w
    from cand c join reactions x on x.target_type = 'post' and x.target_id = c.id
    where x.user_id is distinct from c.author_id
    union all
    select c.id, x.user_id, 0.8 * case when x.created_at > now() - interval '24 hours' then 1.5 else 1.0 end
    from cand c join answers a on a.post_id = c.id and a.is_public and a.status = 'active'
    join reactions x on x.target_type = 'answer' and x.target_id = a.id
    where x.user_id is distinct from c.author_id
  ),
  rp as (
    -- Only substantial replies count, and each person counts once per post.
    select c.id as post_id, r.author_id as user_id, 3.0 as w
    from cand c join replies r on r.post_id = c.id and r.status = 'active'
    where r.author_id is distinct from c.author_id and char_length(r.body) >= 20
    group by c.id, r.author_id
  ),
  an as (
    select c.id as post_id, least(count(*), 10) * 1.5 as w
    from cand c join answers a on a.post_id = c.id and a.is_public and a.status = 'active'
    group by c.id
  ),
  ch as (
    select c.id as post_id, least(count(*), 10) * 2.0 as w
    from cand c join wall_chain_links l on l.parent_post_id = c.id group by c.id
  ),
  eng as (
    select post_id, count(distinct user_id) as users, sum(w) as w from (select * from rx union all select * from rp) u group by post_id
  ),
  pen as (
    select c.id as post_id, count(*) as open_reports
    from cand c join reports r on r.target_type = 'post' and r.target_id = c.id and r.status = 'open' group by c.id
  )
  select c.id, round((
      ln(1 + coalesce(e.w, 0) + coalesce(a.w, 0) + coalesce(h.w, 0))
      * power(0.5, extract(epoch from now() - c.created_at) / (36 * 3600.0))
      * case when c.len < 10 then 0.7 else 1.0 end
      - 0.8 * coalesce(pe.open_reports, 0))::numeric, 4) as score,
    e.users::int
  from cand c
  join eng e on e.post_id = c.id
  left join an a on a.post_id = c.id
  left join ch h on h.post_id = c.id
  left join pen pe on pe.post_id = c.id
  where e.users >= 2
    and ln(1 + coalesce(e.w, 0) + coalesce(a.w, 0) + coalesce(h.w, 0))
        * power(0.5, extract(epoch from now() - c.created_at) / (36 * 3600.0)) - 0.8 * coalesce(pe.open_reports, 0) > 0.05
  order by 2 desc, c.created_at desc
  limit p_limit offset p_offset;
$$;

-- Chains with recent substantive activity across their linked posts.
create or replace function public.trending_chains(p_limit int default 10)
returns table (chain_id uuid, root_post_id uuid, links int, recent_replies int)
language sql stable security definer set search_path = public as $$
  select c.id, c.root_post_id,
    (select count(*) from wall_chain_links l where l.chain_id = c.id)::int,
    (select count(*) from replies r
       where r.status = 'active' and r.created_at > now() - interval '48 hours' and char_length(r.body) >= 20
         and (r.post_id = c.root_post_id or r.post_id in (select child_post_id from wall_chain_links where chain_id = c.id)))::int
  from wall_chains c
  where public.can_view_post(c.root_post_id)
  order by 4 desc, 3 desc limit p_limit;
$$;

-- ---------- profile + discovery stats ----------
create or replace function public.discovery_stats(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'walls_explored', (select count(*) from discoveries where user_id = p_user and kind = 'wall_explored'),
    'false_walls_discovered', (select count(*) from discoveries where user_id = p_user and kind = 'false_wall_revealed'),
    'areas_visited', (select count(*) from discoveries where user_id = p_user and kind = 'area_visited'),
    'chains_explored', (select count(*) from discoveries where user_id = p_user and kind = 'chain_explored'),
    'doors_found', (select count(*) from discoveries where user_id = p_user and kind = 'door_found'),
    'questions_answered', (select count(*) from answers where author_id = p_user and status = 'active'),
    'conversations', (select count(distinct post_id) from replies where author_id = p_user and status = 'active'));
$$;

create or replace function public.get_profile_public(p_username text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); pr profiles%rowtype; s user_settings%rowtype; d profile_details%rowtype; me boolean; staff boolean;
begin
  select * into pr from profiles where username = lower(p_username);
  if not found then return null; end if;
  me := pr.id = uid; staff := public.is_staff();
  if not me and not staff and (pr.status <> 'active' or public.is_blocked_between(uid, pr.id)) then return null; end if;
  select * into s from user_settings where user_id = pr.id;
  select * into d from profile_details where user_id = pr.id;
  return jsonb_build_object(
    'id', pr.id, 'username', pr.username, 'display_name', pr.display_name,
    'avatar_style', pr.avatar_style, 'avatar_color', pr.avatar_color, 'avatar_url', pr.avatar_url,
    'created_at', pr.created_at, 'is_self', me, 'suspended', pr.status <> 'active',
    'is_private', not s.profile_public,
    'bio', case when me or staff or s.profile_public then d.bio end,
    'interests', case when me or staff or s.profile_public then to_jsonb(d.interests) else '[]'::jsonb end,
    'allow_follows', s.allow_follows,
    'show_walls', me or s.show_walls, 'show_answers', me or s.show_answers, 'show_pictures', me or s.show_pictures,
    'following', public.is_following(uid, pr.id),
    'followers_count', (select count(*) from follows where followee_id = pr.id),
    'following_count', (select count(*) from follows where follower_id = pr.id),
    'stats', case when me or s.show_stats then public.discovery_stats(pr.id) end,
    'badges', case when me or s.show_badges then (
        select coalesce(jsonb_agg(jsonb_build_object('slug', b.slug, 'name', b.name, 'description', b.description, 'earned_at', ub.earned_at)
                                  order by ub.earned_at), '[]'::jsonb)
        from user_badges ub join badges b on b.slug = ub.badge_slug where ub.user_id = pr.id) else '[]'::jsonb end);
end $$;

create or replace function public.search_profiles(p_q text, p_limit int default 20) returns table (
  id uuid, username text, display_name text, avatar_style text, avatar_color text, avatar_url text
) language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, p.avatar_style, p.avatar_color, p.avatar_url
  from profiles p join user_settings s on s.user_id = p.id
  where p.status = 'active' and s.discoverable and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and not public.is_blocked_between(auth.uid(), p.id) and not public.is_muted_by(auth.uid(), p.id)
    and length(trim(p_q)) >= 2
    and (p.username ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '\_') || '%'
         or p.display_name ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '\_') || '%')
  order by (p.username = lower(trim(p_q))) desc, p.username limit least(p_limit, 50);
$$;

-- ---------- moderation (staff only, audited) ----------
create or replace function public.mod_log(p_action text, p_type text, p_id text, p_report uuid, p_note text) returns void
language sql security definer set search_path = public as $$
  insert into moderation_actions (moderator_id, action, target_type, target_id, report_id, note)
  values (auth.uid(), p_action, p_type, p_id, p_report, left(p_note, 500));
$$;

create or replace function public.mod_remove_content(p_type text, p_id uuid, p_report uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_type = 'post' then update posts set status = 'removed' where id = p_id;
  elsif p_type = 'answer' then update answers set status = 'removed' where id = p_id;
  elsif p_type = 'reply' then update replies set status = 'removed' where id = p_id;
  elsif p_type = 'question' then update questions set status = 'deleted' where id = p_id;
  else raise exception 'invalid_type'; end if;
  update reports set status = 'actioned', resolved_by = auth.uid(), resolved_at = now()
    where target_type = p_type and target_id = p_id and status = 'open';
  perform public.mod_log('remove_content', p_type, p_id::text, p_report, p_note);
end $$;

create or replace function public.mod_restore_content(p_type text, p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_type = 'post' then update posts set status = 'active' where id = p_id;
  elsif p_type = 'answer' then update answers set status = 'active' where id = p_id;
  elsif p_type = 'reply' then update replies set status = 'active' where id = p_id;
  else raise exception 'invalid_type'; end if;
  perform public.mod_log('restore_content', p_type, p_id::text, null, p_note);
end $$;

create or replace function public.mod_dismiss_report(p_report uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare r reports%rowtype;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  select * into r from reports where id = p_report;
  if not found then raise exception 'not_found'; end if;
  update reports set status = 'dismissed', resolved_by = auth.uid(), resolved_at = now() where id = p_report;
  -- A dismissed auto-hide should not leave innocent content hidden.
  if r.target_type = 'post' then
    update posts set status = 'active' where id = r.target_id and status = 'hidden'
      and not exists (select 1 from reports x where x.target_type = 'post' and x.target_id = r.target_id and x.status = 'open');
  end if;
  perform public.mod_log('dismiss_report', r.target_type, r.target_id::text, p_report, p_note);
end $$;

create or replace function public.mod_set_user_status(p_user uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare target profiles%rowtype;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_status not in ('active','suspended') then raise exception 'invalid_status'; end if;
  select * into target from profiles where id = p_user;
  if not found then raise exception 'not_found'; end if;
  if p_user = auth.uid() then raise exception 'forbidden'; end if;
  if target.role = 'admin' or (target.role = 'moderator' and not public.is_admin()) then raise exception 'forbidden'; end if;
  update profiles set status = p_status where id = p_user;
  if p_status = 'suspended' then
    update reports set status = 'actioned', resolved_by = auth.uid(), resolved_at = now()
      where target_type = 'user' and target_id = p_user and status = 'open';
  end if;
  perform public.mod_log(case when p_status = 'suspended' then 'suspend_user' else 'restore_user' end, 'user', p_user::text, null, p_note);
end $$;

create or replace function public.mod_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('user','moderator','admin') then raise exception 'invalid_role'; end if;
  if p_user = auth.uid() then raise exception 'forbidden'; end if;
  update profiles set role = p_role where id = p_user;
  perform public.mod_log('set_role', 'user', p_user::text, null, p_role);
end $$;

-- Sender lookup is only possible for a question someone has reported, and is always logged.
create or replace function public.mod_get_question_sender(p_question uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q questions%rowtype; sender uuid;
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  select * into q from questions where id = p_question;
  if not found then raise exception 'not_found'; end if;
  if not exists (select 1 from reports where target_type = 'question' and target_id = p_question) then
    raise exception 'no_report';
  end if;
  select coalesce(q.asker_id, (select sender_id from question_senders where question_id = q.id)) into sender;
  perform public.mod_log('view_sender', 'question', p_question::text, null, 'sender lookup for abuse review');
  return (select jsonb_build_object('id', id, 'username', username, 'status', status) from profiles where id = sender);
end $$;

create or replace function public.mod_suppress_trending(p_post uuid, p_suppressed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  if p_suppressed then
    insert into trending_overrides (post_id, suppressed, set_by) values (p_post, true, auth.uid())
      on conflict (post_id) do update set suppressed = true, set_by = auth.uid();
  else delete from trending_overrides where post_id = p_post; end if;
  perform public.mod_log('hide_trending', 'post', p_post::text, null, case when p_suppressed then 'suppressed' else 'restored' end);
end $$;

create or replace function public.admin_upsert_prompt(p_id uuid, p_text text, p_active boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  perform public.screen_text(p_text);
  if p_id is null then
    insert into random_prompts (text, active, created_by) values (trim(p_text), coalesce(p_active, true), auth.uid()) returning id into rid;
  else
    update random_prompts set text = trim(p_text), active = coalesce(p_active, active) where id = p_id returning id into rid;
  end if;
  perform public.mod_log('manage_prompt', 'prompt', rid::text, null, p_text);
  return rid;
end $$;

create or replace function public.admin_upsert_badge(p_slug text, p_name text, p_description text, p_rule text, p_threshold int, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_rule not in ('walls_explored','reveals','areas_visited','conversations_started','early_finds') then raise exception 'invalid_rule'; end if;
  insert into badges (slug, name, description, rule, threshold, active)
  values (p_slug, p_name, p_description, p_rule, p_threshold, coalesce(p_active, true))
  on conflict (slug) do update set name = excluded.name, description = excluded.description,
    rule = excluded.rule, threshold = excluded.threshold, active = excluded.active;
  perform public.mod_log('manage_badge', 'badge', p_slug, null, p_name);
end $$;

create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users', (select count(*) from profiles),
    'suspended', (select count(*) from profiles where status = 'suspended'),
    'new_users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'posts', (select count(*) from posts where not is_sample),
    'posts_7d', (select count(*) from posts where not is_sample and created_at > now() - interval '7 days'),
    'questions', (select count(*) from questions),
    'answers', (select count(*) from answers),
    'open_reports', (select count(*) from reports where status = 'open'),
    'chains', (select count(*) from wall_chains));
end $$;

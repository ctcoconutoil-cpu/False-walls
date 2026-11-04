-- 0012: FALSE WALLS is for people aged 17 and over; visitors can send to a private wall without an account;
-- people holding a private wall's link can read the answers its owner made public.

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
  if yrs < 17 then raise exception 'under_age'; end if;
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

-- Guest questions are rate limited by a salted hash of the visitor's network address, never stored raw.
create table if not exists public.guest_events (
  id bigserial primary key, key text not null, action text not null, created_at timestamptz not null default now()
);
create index if not exists guest_events_idx on public.guest_events (key, action, created_at desc);
alter table public.guest_events enable row level security;
revoke all on public.guest_events from anon, authenticated;

create or replace function public.get_shared_wall(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'body', p.body, 'wall_color', p.wall_color, 'wall_icon', p.wall_icon,
    'template', p.template, 'options', p.options, 'allow_anonymous', p.allow_anonymous_questions,
    'author', jsonb_build_object('username', a.username, 'display_name', a.display_name,
                                 'avatar_style', a.avatar_style, 'avatar_color', a.avatar_color, 'avatar_url', a.avatar_url),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'question', x.question_text, 'answer', x.body, 'created_at', x.created_at)
                                          order by x.created_at desc)
                         from (select * from answers an where an.post_id = p.id and an.is_public and an.status = 'active'
                               order by an.created_at desc limit 50) x), '[]'::jsonb))
  from posts p join profiles a on a.id = p.author_id
  where p.share_token = p_token and p.type = 'ask_me' and p.status = 'active' and a.status = 'active';
$$;

-- Anyone with the link can leave an anonymous question. The sender is not recorded at all.
create or replace function public.send_guest_question(p_token text, p_body text, p_key text) returns uuid
language plpgsql security definer set search_path = public as $$
declare p posts%rowtype; s user_settings%rowtype; qid uuid; v_body text := trim(p_body); sev int;
begin
  if p_key is null or char_length(p_key) < 16 then raise exception 'not_authenticated'; end if;
  select * into p from posts where share_token = p_token and type = 'ask_me' and status = 'active' and visibility = 'link';
  if not found or not exists (select 1 from profiles a where a.id = p.author_id and a.status = 'active') then raise exception 'not_found'; end if;
  select * into s from user_settings where user_id = p.author_id;
  if not (p.allow_anonymous_questions and s.allow_anonymous_questions) then raise exception 'anonymous_disabled'; end if;
  if public.is_teen(p.author_id) then raise exception 'anonymous_disabled'; end if;
  if char_length(coalesce(v_body, '')) < 1 or char_length(v_body) > 500 then raise exception 'invalid_length'; end if;
  if (select count(*) from guest_events where key = p_key and action = 'q' and created_at > now() - interval '1 hour') >= 6
     or (select count(*) from guest_events where key = p_key and action = 'q' and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;
  if (select count(*) from questions where post_id = p.id and asker_id is null and created_at > now() - interval '1 hour'
        and not exists (select 1 from question_senders qs where qs.question_id = questions.id)) >= 100 then raise exception 'rate_limited'; end if;
  if exists (select 1 from questions q where q.post_id = p.id and lower(q.body) = lower(v_body) and q.created_at > now() - interval '7 days') then
    raise exception 'duplicate';
  end if;
  if v_body ~* '(who (are|r) you|reveal (yourself|your name)|i will (find|track) you|i know who you are|doxx?)' then raise exception 'content_not_allowed'; end if;
  sev := public.screen_text(v_body);
  insert into guest_events (key, action) values (p_key, 'q');
  if random() < 0.02 then delete from guest_events where created_at < now() - interval '2 days'; end if;
  insert into questions (post_id, recipient_id, asker_id, is_anonymous, body, status)
  values (p.id, p.author_id, null, true, v_body, 'pending') returning id into qid;
  if sev >= 1 then perform public.auto_flag('question', qid); end if;
  perform public.notify(p.author_id, 'question', null, p.id, jsonb_build_object('question_id', qid, 'anonymous', true));
  return qid;
end $$;

revoke all on function public.send_guest_question(text,text,text) from public;
grant execute on function public.send_guest_question(text,text,text) to anon, authenticated;
revoke all on function public.get_shared_wall(text) from public;
grant execute on function public.get_shared_wall(text) to anon, authenticated;

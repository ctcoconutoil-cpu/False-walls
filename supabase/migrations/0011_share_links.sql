-- 0011: private link walls, "Pick a number" walls, and share links for walls and questions.
-- A link wall is not listed anywhere. Only its author, and people holding its unguessable share token, can see it.

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('public','followers','link'));
alter table public.posts add column if not exists share_token text unique;
alter table public.posts add column if not exists template text check (template is null or template in ('pick_number'));
alter table public.posts add column if not exists options jsonb;
alter table public.posts add constraint posts_link_needs_token check (visibility <> 'link' or share_token is not null);
alter table public.questions add column if not exists share_token text unique;

-- Creates a private link wall (an Ask Me wall, optionally the "Pick a number" template). It never gets a spot on the public Wall.
create or replace function public.create_private_wall(
  p_title text, p_body text, p_template text, p_options jsonb, p_wall_color text, p_wall_icon text, p_allow_anonymous boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); pid uuid := gen_random_uuid(); tok text := replace(gen_random_uuid()::text, '-', '');
  s user_settings%rowtype; anon boolean; sev int; opt jsonb := null; n int;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  perform public.check_rate_limit('create_private_wall', 10, interval '1 hour');
  if p_template is not null and p_template <> 'pick_number' then raise exception 'invalid_input'; end if;
  if char_length(coalesce(trim(p_title), '')) < 3 or char_length(trim(p_title)) > 120 then raise exception 'title_required'; end if;
  if char_length(coalesce(p_body, '')) > 300 then raise exception 'invalid_length'; end if;
  if p_wall_color is not null and p_wall_color not in ('coral','mustard','teal','violet','sky','lime','rose','slate') then raise exception 'invalid_input'; end if;
  if p_wall_icon is not null and char_length(p_wall_icon) not between 1 and 8 then raise exception 'invalid_input'; end if;
  if p_template = 'pick_number' then
    if p_options is null or jsonb_typeof(p_options) <> 'array' then raise exception 'invalid_options'; end if;
    select jsonb_agg(left(trim(v), 80)) into opt from jsonb_array_elements_text(p_options) v where char_length(trim(v)) > 0;
    n := coalesce(jsonb_array_length(opt), 0);
    if n < 3 or n > 10 then raise exception 'invalid_options'; end if;
  end if;
  sev := public.screen_text(p_title, p_body, coalesce(opt::text, ''));
  select * into s from user_settings where user_id = uid;
  anon := coalesce(p_allow_anonymous, true) and coalesce(s.allow_anonymous_questions, false);
  insert into posts (id, author_id, type, title, body, wall_color, wall_icon, visibility, reveal_mode,
                     allow_anonymous_questions, allow_replies, allow_chains, area_slug, share_token, template, options)
  values (pid, uid, 'ask_me', trim(p_title), nullif(trim(p_body), ''), coalesce(p_wall_color, 'coral'), p_wall_icon, 'link', 'anyone',
          anon, false, false, 'question', tok, p_template, opt);
  if sev >= 1 then perform public.auto_flag('post', pid); end if;
  return jsonb_build_object('id', pid, 'token', tok);
end $$;

-- What a visitor with the link may see. Nothing concealed is ever returned.
create or replace function public.get_shared_wall(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'title', p.title, 'body', p.body, 'wall_color', p.wall_color, 'wall_icon', p.wall_icon,
    'template', p.template, 'options', p.options, 'allow_anonymous', p.allow_anonymous_questions,
    'author', jsonb_build_object('username', a.username, 'display_name', a.display_name,
                                 'avatar_style', a.avatar_style, 'avatar_color', a.avatar_color))
  from posts p join profiles a on a.id = p.author_id
  where p.share_token = p_token and p.type = 'ask_me' and p.status = 'active' and a.status = 'active';
$$;

create or replace function public.send_question(p_post uuid, p_body text, p_anonymous boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); p posts%rowtype; s user_settings%rowtype; qid uuid; shadow boolean := false; sev int;
  v_body text := trim(p_body);
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select * into p from posts where id = p_post;
  if not found or p.is_sample or p.author_id is null or p.status <> 'active' then raise exception 'not_askable'; end if;
  -- A private link wall can be asked through its share link (see send_question_via_link) even though it is not listed.
  if not public.can_view_post(p_post)
     and not (p.visibility = 'link' and current_setting('app.link_post', true) is not distinct from p_post::text) then
    raise exception 'not_found';
  end if;
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

create or replace function public.send_question_via_link(p_token text, p_body text, p_anonymous boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pid uuid; aid uuid;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select id, author_id into pid, aid from posts where share_token = p_token and type = 'ask_me' and status = 'active';
  if pid is null then raise exception 'not_found'; end if;
  if public.is_blocked_between(uid, aid) then raise exception 'not_found'; end if;
  perform set_config('app.link_post', pid::text, true);
  return public.send_question(pid, p_body, p_anonymous);
end $$;

-- Lets the person who received an anonymous question share it. Questions from named people are never shareable.
create or replace function public.share_question(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); q questions%rowtype; tok text;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  select * into q from questions where id = p_id and recipient_id = uid and status in ('pending','answered');
  if not found then raise exception 'not_found'; end if;
  if not q.is_anonymous then raise exception 'not_shareable'; end if;
  tok := coalesce(q.share_token, replace(gen_random_uuid()::text, '-', ''));
  update questions set share_token = tok where id = p_id;
  return tok;
end $$;

create or replace function public.get_shared_question(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'question', q.body, 'answered', q.status = 'answered',
    'answer', case when a.is_public and a.status = 'active' then a.body end,
    'wall_token', (select w.share_token from posts w where w.id = q.post_id and w.visibility = 'link' and w.status = 'active'),
    'author', jsonb_build_object('username', r.username, 'display_name', r.display_name,
                                 'avatar_style', r.avatar_style, 'avatar_color', r.avatar_color))
  from questions q join profiles r on r.id = q.recipient_id left join answers a on a.question_id = q.id
  where q.share_token = p_token and q.is_anonymous and q.status in ('pending','answered') and r.status = 'active';
$$;

revoke all on function public.create_private_wall(text,text,text,jsonb,text,text,boolean) from public, anon;
revoke all on function public.send_question_via_link(text,text,boolean) from public, anon;
revoke all on function public.share_question(uuid) from public, anon;
revoke all on function public.get_shared_wall(text) from public;
revoke all on function public.get_shared_question(text) from public;
grant execute on function public.create_private_wall(text,text,text,jsonb,text,text,boolean) to authenticated;
grant execute on function public.send_question_via_link(text,text,boolean) to authenticated;
grant execute on function public.share_question(uuid) to authenticated;
grant execute on function public.get_shared_wall(text) to anon, authenticated;
grant execute on function public.get_shared_question(text) to anon, authenticated;

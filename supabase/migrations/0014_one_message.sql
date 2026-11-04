-- 0014: one message per visitor on any private link wall.

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
  -- A private wall takes one message per visitor.
  if exists (select 1 from guest_events where key = p_key and post_id = p.id) then raise exception 'already_sent'; end if;
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
  insert into guest_events (key, action, post_id) values (p_key, 'q', p.id);
  if random() < 0.02 then delete from guest_events where created_at < now() - interval '2 days'; end if;
  insert into questions (post_id, recipient_id, asker_id, is_anonymous, body, status)
  values (p.id, p.author_id, null, true, v_body, 'pending') returning id into qid;
  if sev >= 1 then perform public.auto_flag('question', qid); end if;
  perform public.notify(p.author_id, 'question', null, p.id, jsonb_build_object('question_id', qid, 'anonymous', true));
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
  if exists (select 1 from questions q left join question_senders qs on qs.question_id = q.id
                                     where q.post_id = pid and (q.asker_id = uid or qs.sender_id = uid)) then raise exception 'already_sent'; end if;
  perform set_config('app.link_post', pid::text, true);
  return public.send_question(pid, p_body, p_anonymous);
end $$;
revoke all on function public.send_question_via_link(text,text,boolean) from public, anon;
grant execute on function public.send_question_via_link(text,text,boolean) to authenticated;

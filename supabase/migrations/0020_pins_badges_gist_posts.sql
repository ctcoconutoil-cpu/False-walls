-- FALSE WALLS 0020: pinned posts, current badges, gist without following, unlimited reposting.

-- 1. Posting: no duplicate check, much higher limits (signed-in members can post as much as they like).
do $$
declare d text; r record;
begin
  for r in select oid from pg_proc where proname = 'create_post' and pronamespace = 'public'::regnamespace loop
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(d, 'if exists \(select 1 from posts where author_id = uid and created_at > now\(\) - interval ''1 day''.*?raise exception ''duplicate'';\s*end if;', '', 's');
    d := replace(d, 'check_rate_limit(''create_post'', 12, interval ''1 hour'')', 'check_rate_limit(''create_post'', 120, interval ''1 hour'')');
    d := replace(d, 'check_rate_limit(''create_post_day'', 40, interval ''1 day'')', 'check_rate_limit(''create_post_day'', 600, interval ''1 day'')');
    execute d;
  end loop;
end $$;

-- 2. Gist: anyone can post; your own gist always shows in Following. "For you" stays empty until you follow someone.
create or replace function public.gist_feed(p_tab text, p_before timestamptz default null, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then return '[]'::jsonb; end if;
  if p_tab = 'foryou' and not exists (select 1 from follows where follower_id = uid) then return '[]'::jsonb; end if;
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

-- 3. Pinned posts on a profile (up to 3, in the order the owner chose).
create table public.pinned_posts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
alter table public.pinned_posts enable row level security;
create policy pinned_read on public.pinned_posts for select to anon, authenticated using (true);
revoke all on public.pinned_posts from anon, authenticated;
grant select on public.pinned_posts to anon, authenticated;

create or replace function public.pin_post(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from posts where id = p_post and author_id = uid and status = 'active') then raise exception 'not_found'; end if;
  if exists (select 1 from pinned_posts where user_id = uid and post_id = p_post) then return; end if;
  if (select count(*) from pinned_posts where user_id = uid) >= 3 then raise exception 'pins_full'; end if;
  insert into pinned_posts (user_id, post_id, position) values (uid, p_post, coalesce((select max(position) + 1 from pinned_posts where user_id = uid), 0));
end $$;

create or replace function public.unpin_post(p_post uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from pinned_posts where user_id = auth.uid() and post_id = p_post;
  -- Close the gap so positions stay 0,1,2.
  update pinned_posts p set position = n.rn from (select post_id, row_number() over (order by position) - 1 as rn from pinned_posts where user_id = auth.uid()) n
    where p.user_id = auth.uid() and p.post_id = n.post_id;
end $$;

-- p_dir: -1 moves a pin earlier, 1 moves it later.
create or replace function public.move_pin(p_post uuid, p_dir int) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); me int; other uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select position into me from pinned_posts where user_id = uid and post_id = p_post;
  if me is null then return; end if;
  select post_id into other from pinned_posts where user_id = uid and position = me + (case when p_dir < 0 then -1 else 1 end);
  if other is null then return; end if;
  update pinned_posts set position = case when post_id = p_post then me + (case when p_dir < 0 then -1 else 1 end) else me end
    where user_id = uid and post_id in (p_post, other);
end $$;
revoke all on function public.pin_post(uuid), public.unpin_post(uuid), public.move_pin(uuid, int) from public, anon;
grant execute on function public.pin_post(uuid), public.unpin_post(uuid), public.move_pin(uuid, int) to authenticated;

-- 4. Badges that match what the app has now.
create or replace function public.award_badges(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b badges%rowtype; n int;
begin
  for b in select * from badges where active loop
    if exists (select 1 from user_badges where user_id = p_user and badge_slug = b.slug) then continue; end if;
    n := case b.rule
      when 'walls_explored' then (select count(*) from discoveries where user_id = p_user and kind = 'wall_explored')
      when 'reveals' then (select count(*) from discoveries where user_id = p_user and kind = 'false_wall_revealed')
      when 'conversations_started' then (
        select count(*) from posts p where p.author_id = p_user and p.status = 'active' and (
          select count(*) from replies r where r.post_id = p.id and r.status = 'active' and r.author_id <> p_user) >= 3
          and (select count(distinct r.author_id) from replies r where r.post_id = p.id and r.status = 'active' and r.author_id <> p_user) >= 2)
      when 'early_finds' then (
        select count(*) from reactions x join posts p on p.id = x.target_id and x.target_type = 'post'
        where x.user_id = p_user and p.author_id is distinct from p_user
          and x.created_at < p.created_at + interval '6 hours'
          and (select count(distinct y.user_id) from reactions y
               where y.target_type = 'post' and y.target_id = p.id and y.user_id is distinct from p.author_id) >= 8)
      when 'experiences' then (select count(*) from experiences where author_id = p_user and status = 'active')
      when 'gists' then (select count(*) from gists where author_id = p_user and status = 'active')
      when 'private_wall' then (select count(*) from private_walls where owner_id = p_user)
      when 'messages_received' then (select count(*) from submissions where owner_id = p_user)
      when 'pins' then (select count(*) from pinned_posts where user_id = p_user)
      else 0 end;
    if n >= b.threshold then
      insert into user_badges (user_id, badge_slug) values (p_user, b.slug) on conflict do nothing;
      perform public.notify(p_user, 'badge', null, null, jsonb_build_object('badge', b.slug, 'name', b.name));
    end if;
  end loop;
end $$;

-- The maze and its areas are gone, so the Explorer badge goes with them.
update public.badges set active = false where slug = 'explorer';
update public.badges set description = 'Explored 25 different walls.' where slug = 'wall_walker';
update public.badges set description = 'Opened 5 False Walls to see what was behind them.' where slug = 'truth_finder';
insert into public.badges (slug, name, description, rule, threshold, sort_order) values
  ('experience_host', 'Experience Host', 'Shared an experience in Discover.', 'experiences', 1, 5),
  ('gist_teller', 'Gist Teller', 'Posted 5 gists.', 'gists', 5, 6),
  ('wall_owner', 'Wall Owner', 'Opened your own private wall.', 'private_wall', 1, 7),
  ('fan_mail', 'Fan Mail', 'Received 10 anonymous messages on your private wall.', 'messages_received', 10, 8),
  ('curator', 'Curator', 'Pinned 3 favourites to your profile.', 'pins', 3, 9)
on conflict (slug) do update set name = excluded.name, description = excluded.description, rule = excluded.rule, threshold = excluded.threshold, sort_order = excluded.sort_order, active = true;

create or replace function public.badge_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.award_badges((to_jsonb(new) ->> tg_argv[0])::uuid);
  return null;
end $$;
create trigger experiences_badges after insert on public.experiences for each row execute function public.badge_trigger('author_id');
create trigger gists_badges after insert on public.gists for each row execute function public.badge_trigger('author_id');
create trigger private_walls_badges after insert on public.private_walls for each row execute function public.badge_trigger('owner_id');
create trigger submissions_badges after insert on public.submissions for each row execute function public.badge_trigger('owner_id');
create trigger pins_badges after insert on public.pinned_posts for each row execute function public.badge_trigger('user_id');

-- 5. More conversation prompts.
insert into public.random_prompts (text) select t from unnest(array[
'What is the best advice you ever ignored?','What is a small thing that instantly improves your day?','What is a habit you are proud of building?','What do you wish people asked you more often?','What is a skill you would learn overnight if you could?','What is the kindest thing a stranger did for you?','What is a movie or show you can rewatch forever?','What is a belief you changed your mind about?','What is the most useful thing you own?','What would you do with a free week and no plans?','What is a food you will defend to the end?','What is a place you want to go back to?','What is something you are secretly good at?','What is a rule you live by?','What is a compliment you still remember?','What is a mistake that taught you the most?','What is a song that takes you back instantly?','What do you do when you cannot sleep?','What is a tradition you would like to start?','What is the best thing you have learned this year?','What is something you wish you had started sooner?','Which one thing would you change about mornings?','What is your most random talent?','What would your younger self be surprised by?','What is the best gift you have given someone?','What makes a good friend?','What is a topic you could talk about for hours?','What is a risk that paid off?','What is something you are looking forward to?','What is a goal you are working on quietly?'
]) t where not exists (select 1 from public.random_prompts r where r.text = t);

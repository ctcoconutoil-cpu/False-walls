-- FALSE WALLS 0021: Walls Gist gets reactions, comments and a shareable page. Likes become "heart" reactions.

create table public.gist_reactions (
  gist_id uuid not null references public.gists (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('heart','laugh','wow','sad','fire')),
  created_at timestamptz not null default now(),
  primary key (gist_id, user_id)
);
insert into public.gist_reactions (gist_id, user_id, kind, created_at) select gist_id, user_id, 'heart', created_at from public.gist_likes on conflict do nothing;
drop function public.toggle_gist_like(uuid);
drop table public.gist_likes;

create table public.gist_comments (
  id uuid primary key default gen_random_uuid(),
  gist_id uuid not null references public.gists (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now()
);
create index gist_comments_gist_idx on public.gist_comments (gist_id, created_at);
alter table public.gist_reactions enable row level security;
alter table public.gist_comments enable row level security;
create policy gist_comments_delete_own on public.gist_comments for delete to authenticated using (author_id = auth.uid() or public.is_staff());
revoke all on public.gist_reactions, public.gist_comments from anon, authenticated;
grant delete on public.gist_comments to authenticated;

-- One gist as the app shows it: text, author, reaction counts, your reaction, comment count.
create or replace function public.gist_row(p_gist uuid, p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', g.id, 'body', g.body, 'created_at', g.created_at, 'mine', g.author_id = p_uid,
    'reactions', coalesce((select jsonb_object_agg(r.kind, r.n) from (select kind, count(*) n from gist_reactions where gist_id = g.id group by kind) r), '{}'::jsonb),
    'my', (select kind from gist_reactions where gist_id = g.id and user_id = p_uid),
    'comments', (select count(*) from gist_comments c where c.gist_id = g.id and c.status = 'active'),
    'author', jsonb_build_object('username', a.username, 'display_name', a.display_name, 'avatar_style', a.avatar_style, 'avatar_color', a.avatar_color, 'avatar_url', a.avatar_url))
  from gists g join profiles a on a.id = g.author_id where g.id = p_gist;
$$;
revoke all on function public.gist_row(uuid, uuid) from public, anon, authenticated;

create or replace function public.gist_feed(p_tab text, p_before timestamptz default null, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then return '[]'::jsonb; end if;
  if p_tab = 'foryou' and not exists (select 1 from follows where follower_id = uid) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(t.row order by t.created_at desc) from (
      select public.gist_row(g.id, uid) as row, g.created_at
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

create or replace function public.get_gist(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.gist_row(g.id, auth.uid()) from gists g join profiles a on a.id = g.author_id
  where g.id = p_id and g.status = 'active' and a.status = 'active' and auth.uid() is not null and public.is_member()
    and not public.is_blocked_between(auth.uid(), g.author_id);
$$;

create or replace function public.react_gist(p_gist uuid, p_kind text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cur text;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if p_kind not in ('heart','laugh','wow','sad','fire') then raise exception 'invalid_input'; end if;
  if not exists (select 1 from gists g where g.id = p_gist and g.status = 'active' and not public.is_blocked_between(uid, g.author_id)) then raise exception 'not_found'; end if;
  select kind into cur from gist_reactions where gist_id = p_gist and user_id = uid;
  if cur = p_kind then delete from gist_reactions where gist_id = p_gist and user_id = uid; return null; end if;
  insert into gist_reactions (gist_id, user_id, kind) values (p_gist, uid, p_kind)
    on conflict (gist_id, user_id) do update set kind = excluded.kind, created_at = now();
  return p_kind;
end $$;

create or replace function public.add_gist_comment(p_gist uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); b text := trim(p_body); cid uuid;
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if char_length(b) not between 1 and 280 then raise exception 'invalid_length'; end if;
  if not exists (select 1 from gists g where g.id = p_gist and g.status = 'active' and not public.is_blocked_between(uid, g.author_id)) then raise exception 'not_found'; end if;
  if (select count(*) from gist_comments where author_id = uid and created_at > now() - interval '1 hour') >= 60 then raise exception 'rate_limited'; end if;
  perform public.screen_text(b);
  insert into gist_comments (gist_id, author_id, body) values (p_gist, uid, b) returning id into cid;
  return cid;
end $$;

create or replace function public.gist_comment_list(p_gist uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'body', c.body, 'created_at', c.created_at, 'mine', c.author_id = auth.uid(),
    'author', jsonb_build_object('username', a.username, 'display_name', a.display_name, 'avatar_style', a.avatar_style, 'avatar_color', a.avatar_color, 'avatar_url', a.avatar_url)) order by c.created_at), '[]'::jsonb)
  from gist_comments c join profiles a on a.id = c.author_id join gists g on g.id = c.gist_id
  where c.gist_id = p_gist and c.status = 'active' and a.status = 'active' and auth.uid() is not null and public.is_member()
    and g.status = 'active' and not public.is_blocked_between(auth.uid(), g.author_id) and not public.is_blocked_between(auth.uid(), c.author_id);
$$;

revoke all on function public.get_gist(uuid), public.react_gist(uuid, text), public.add_gist_comment(uuid, text), public.gist_comment_list(uuid) from public, anon;
grant execute on function public.get_gist(uuid), public.react_gist(uuid, text), public.add_gist_comment(uuid, text), public.gist_comment_list(uuid) to authenticated;

update public.badges set name = 'Gist Teller', description = 'Posted 5 times on Walls Gist.' where slug = 'gist_teller';

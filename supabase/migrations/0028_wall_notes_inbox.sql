-- FALSE WALLS 0028: messages can be sent to a post note on a private wall, the owner can reply, and the inbox lists conversations.
alter table public.submissions add column if not exists reply text check (reply is null or char_length(reply) between 1 and 500);
alter table public.submissions add column if not exists replied_at timestamptz;
grant update (reply, replied_at, read_at) on public.submissions to authenticated;

do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where proname = 'submit_to_card' and pronamespace = 'public'::regnamespace;
  d := replace(d, 'where id = p_card and kind = ''prompt''', 'where id = p_card and kind in (''prompt'', ''post'')');
  execute d;
end $$;

create or replace function public.inbox_activity() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'convos', coalesce((select jsonb_agg(x order by (x->>'created_at') desc) from (
      select jsonb_build_object('id', r.id, 'body', r.body, 'created_at', r.created_at, 'post_id', p.id,
        'post_title', coalesce(p.title, p.clue, p.body),
        'author', jsonb_build_object('username', a.username, 'display_name', a.display_name, 'avatar_style', a.avatar_style, 'avatar_color', a.avatar_color, 'avatar_url', a.avatar_url)) x
      from replies r join posts p on p.id = r.post_id join profiles a on a.id = r.author_id
      where p.author_id = auth.uid() and r.author_id <> auth.uid() and r.status = 'active' and p.visibility <> 'wall'
      order by r.created_at desc limit 40) q), '[]'::jsonb),
    'gist', coalesce((select jsonb_agg(x order by (x->>'created_at') desc) from (
      select jsonb_build_object('id', c.id, 'body', c.body, 'created_at', c.created_at, 'gist_id', g.id, 'gist_body', g.body,
        'author', jsonb_build_object('username', a.username, 'display_name', a.display_name, 'avatar_style', a.avatar_style, 'avatar_color', a.avatar_color, 'avatar_url', a.avatar_url)) x
      from gist_comments c join gists g on g.id = c.gist_id join profiles a on a.id = c.author_id
      where g.author_id = auth.uid() and c.author_id <> auth.uid() and c.status = 'active'
      order by c.created_at desc limit 40) q), '[]'::jsonb));
$$;
revoke all on function public.inbox_activity() from public, anon;
grant execute on function public.inbox_activity() to authenticated;

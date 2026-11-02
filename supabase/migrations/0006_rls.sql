-- FALSE WALLS 0006: row level security. Default deny; every grant below is deliberate.

alter table public.profiles enable row level security;
alter table public.profile_details enable row level security;
alter table public.user_settings enable row level security;
alter table public.maze_areas enable row level security;
alter table public.random_prompts enable row level security;
alter table public.posts enable row level security;
alter table public.post_secrets enable row level security;
alter table public.post_media enable row level security;
alter table public.post_reveals enable row level security;
alter table public.wall_locations enable row level security;
alter table public.questions enable row level security;
alter table public.question_senders enable row level security;
alter table public.answers enable row level security;
alter table public.replies enable row level security;
alter table public.reactions enable row level security;
alter table public.saved_posts enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.wall_chains enable row level security;
alter table public.wall_chain_links enable row level security;
alter table public.discoveries enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.trending_overrides enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.blocked_terms enable row level security;
alter table public.poll_votes enable row level security;

-- Identity: visible unless suspended or blocked; users edit only their own row (role/status are trigger-protected).
create policy profiles_read on public.profiles for select to anon, authenticated
  using (id = auth.uid() or public.is_staff()
         or (status = 'active' and not public.is_blocked_between(auth.uid(), id)));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_member()) with check (id = auth.uid());

create or replace function public.profile_is_public(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_settings s join profiles p on p.id = s.user_id
    where s.user_id = p_user and s.profile_public and p.status = 'active')
    and not public.is_blocked_between(auth.uid(), p_user);
$$;
create policy details_read on public.profile_details for select to anon, authenticated
  using (user_id = auth.uid() or public.is_staff() or public.profile_is_public(user_id));
create policy details_update_own on public.profile_details for update to authenticated
  using (user_id = auth.uid() and public.is_member()) with check (user_id = auth.uid());

create policy settings_read_own on public.user_settings for select to authenticated using (user_id = auth.uid());
create policy settings_update_own on public.user_settings for update to authenticated
  using (user_id = auth.uid() and public.is_member()) with check (user_id = auth.uid());

-- Public reference data
create policy areas_read on public.maze_areas for select to anon, authenticated using (true);
create policy prompts_read on public.random_prompts for select to anon, authenticated using (active or public.is_admin());
create policy badges_read on public.badges for select to anon, authenticated using (active or public.is_admin());

-- Posts: reading follows the visibility rule; writes go through create_post/edit_post. Authors may delete.
create policy posts_read on public.posts for select to anon, authenticated
  using (public.post_visible(author_id, visibility, status));
create policy posts_delete_own on public.posts for delete to authenticated
  using (author_id = auth.uid() and public.is_member());

-- Concealed content is never selectable by ordinary readers. Only reveal_post() returns it.
create policy secrets_author on public.post_secrets for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()) or public.is_staff());

create policy media_read on public.post_media for select to anon, authenticated
  using (
    owner_id = auth.uid() or public.is_staff()
    or (not is_hidden and public.can_view_post(post_id))
    or (is_hidden and exists (select 1 from public.post_reveals r where r.post_id = post_media.post_id and r.user_id = auth.uid()))
  );
create policy media_delete_own on public.post_media for delete to authenticated
  using (owner_id = auth.uid() and public.is_member());

create policy reveals_read_own on public.post_reveals for select to authenticated using (user_id = auth.uid());
create policy locations_read on public.wall_locations for select to anon, authenticated using (public.can_view_post(post_id));

-- Questions: recipient, identified asker, and the anonymous sender (own rows only). Staff only when reported.
create policy questions_read on public.questions for select to authenticated
  using (
    recipient_id = auth.uid() or asker_id = auth.uid()
    or exists (select 1 from public.question_senders qs where qs.question_id = questions.id and qs.sender_id = auth.uid())
    or (public.is_staff() and exists (select 1 from public.reports r where r.target_type = 'question' and r.target_id = questions.id))
  );
create policy senders_read_own on public.question_senders for select to authenticated using (sender_id = auth.uid());

create policy answers_read on public.answers for select to anon, authenticated
  using (
    (status = 'active' and is_public and public.can_view_post(post_id))
    or author_id = auth.uid() or asker_id = auth.uid()
    or exists (select 1 from public.question_senders qs where qs.question_id = answers.question_id and qs.sender_id = auth.uid())
    or public.is_staff()
  );
create policy answers_delete_own on public.answers for delete to authenticated using (author_id = auth.uid() and public.is_member());

create policy replies_read on public.replies for select to anon, authenticated
  using (
    author_id = auth.uid() or public.is_staff()
    or (status = 'active' and public.can_view_post(post_id)
        and not public.is_blocked_between(auth.uid(), author_id) and not public.is_muted_by(auth.uid(), author_id))
  );
create policy replies_delete_own on public.replies for delete to authenticated using (author_id = auth.uid() and public.is_member());

-- Reactions: a user sees only their own rows. Everyone else gets counts through reaction_counts().
create policy reactions_read_own on public.reactions for select to authenticated using (user_id = auth.uid());
create policy reactions_delete_own on public.reactions for delete to authenticated using (user_id = auth.uid());

create or replace function public.reaction_counts(p_type text, p_ids uuid[])
returns table (target_id uuid, kind text, n int, mine boolean)
language sql stable security definer set search_path = public as $$
  select r.target_id, r.kind, count(*)::int, coalesce(bool_or(r.user_id = auth.uid()), false)
  from reactions r
  where r.target_type = p_type and r.target_id = any (p_ids) and public.can_view_target(p_type, r.target_id)
  group by r.target_id, r.kind;
$$;

create policy saved_all_own on public.saved_posts for select to authenticated using (user_id = auth.uid());
create policy saved_insert_own on public.saved_posts for insert to authenticated
  with check (user_id = auth.uid() and public.is_member() and public.can_view_post(post_id));
create policy saved_delete_own on public.saved_posts for delete to authenticated using (user_id = auth.uid());

create policy follows_read_own on public.follows for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());
create policy follows_insert_own on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and public.can_follow(followee_id));
create policy follows_delete_own on public.follows for delete to authenticated using (follower_id = auth.uid());

-- Blocks of anonymous senders are never selectable, so their ids cannot leak to the blocker.
create policy blocks_read_own on public.blocks for select to authenticated using (blocker_id = auth.uid() and not hidden_identity);
create or replace function public.is_plain_user(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and role = 'user');
$$;
create policy blocks_insert_own on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid() and public.is_member() and public.is_plain_user(blocked_id));
create policy blocks_update_own on public.blocks for update to authenticated
  using (blocker_id = auth.uid() and not hidden_identity) with check (blocker_id = auth.uid() and not hidden_identity);
create policy blocks_delete_own on public.blocks for delete to authenticated using (blocker_id = auth.uid() and not hidden_identity);

-- The blocked-people list. Anonymous senders appear as "Anonymous sender" with only an opaque reference.
create or replace function public.my_blocks() returns table (
  ref uuid, kind text, anonymous boolean, blocked_id uuid, username text, display_name text,
  avatar_style text, avatar_color text, avatar_url text, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select b.ref, b.kind, b.hidden_identity,
    case when b.hidden_identity then null else b.blocked_id end,
    case when b.hidden_identity then null else p.username end,
    case when b.hidden_identity then null else p.display_name end,
    case when b.hidden_identity then null else p.avatar_style end,
    case when b.hidden_identity then null else p.avatar_color end,
    case when b.hidden_identity then null else p.avatar_url end,
    b.created_at
  from blocks b join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid() order by b.created_at desc;
$$;
create or replace function public.unblock_ref(p_ref uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from blocks where ref = p_ref and blocker_id = auth.uid();
  if not found then raise exception 'not_found'; end if;
end $$;

create policy chains_read on public.wall_chains for select to anon, authenticated using (public.can_view_post(root_post_id));
create policy chain_links_read on public.wall_chain_links for select to anon, authenticated
  using (public.can_view_post(parent_post_id) and public.can_view_post(child_post_id));

create policy discoveries_read_own on public.discoveries for select to authenticated using (user_id = auth.uid());
create policy user_badges_read_own on public.user_badges for select to authenticated using (user_id = auth.uid() or public.is_staff());

create policy notifications_read_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete_own on public.notifications for delete to authenticated using (user_id = auth.uid());

create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_staff());
create policy mod_actions_read on public.moderation_actions for select to authenticated using (public.is_staff());
create policy overrides_read on public.trending_overrides for select to authenticated using (public.is_staff());
create policy terms_read_admin on public.blocked_terms for select to authenticated using (public.is_admin());
create policy poll_votes_read_own on public.poll_votes for select to authenticated using (user_id = auth.uid());
-- rate_limit_events: no policies, so no client access at all.

-- Keep at least one image on a picture post unless the whole post is being deleted.
create or replace function public.post_media_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from posts p where p.id = old.post_id and p.type = 'picture')
     and not exists (select 1 from post_media m where m.post_id = old.post_id and m.id <> old.id) then
    raise exception 'last_image';
  end if;
  return old;
end $$;
create trigger post_media_guard_trg before delete on public.post_media
  for each row execute function public.post_media_guard();

-- Internal helpers must not be callable straight from the API.
revoke execute on function
  public.notify(uuid, text, uuid, uuid, jsonb), public.award_badges(uuid), public.auto_flag(text, uuid, text),
  public.check_rate_limit(text, int, interval), public.screen_text(text[]), public.term_severity(text),
  public.mod_log(text, text, text, uuid, text), public.discovery_stats(uuid),
  public.set_updated_at(), public.profiles_guard(), public.reports_after_insert(),
  public.follows_before_insert(), public.follows_after_insert(), public.blocks_after_insert(), public.post_media_guard()
from public, anon, authenticated;

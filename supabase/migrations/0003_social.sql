-- FALSE WALLS 0003: follows, blocks, chains, discoveries, badges, notifications

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

-- kind 'block' hides both users from each other; 'mute' only hides the muted user from the muter.
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'block' check (kind in ('block','mute')),
  -- true when the blocker blocked an anonymous question sender: the row is then invisible to the blocker.
  hidden_identity boolean not null default false,
  ref uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.wall_chains (
  id uuid primary key default gen_random_uuid(),
  root_post_id uuid not null unique references public.posts (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.wall_chain_links (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.wall_chains (id) on delete cascade,
  parent_post_id uuid not null references public.posts (id) on delete cascade,
  child_post_id uuid not null unique references public.posts (id) on delete cascade,
  via_answer_id uuid references public.answers (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (parent_post_id <> child_post_id)
);
create index chain_links_chain_idx on public.wall_chain_links (chain_id);
create index chain_links_parent_idx on public.wall_chain_links (parent_post_id);

-- Each (user, kind, target) is counted once, so re-opening content never farms progress.
create table public.discoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('wall_explored','false_wall_revealed','area_visited','chain_explored','door_found')),
  target_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, target_key)
);
create index discoveries_user_idx on public.discoveries (user_id, kind);

create table public.badges (
  slug text primary key,
  name text not null,
  description text not null,
  rule text not null,
  threshold int not null check (threshold > 0),
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_slug text not null references public.badges (slug) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_slug)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('question','answer','reply','reaction','follow','chain','badge','discovery')),
  actor_id uuid references public.profiles (id) on delete set null,
  post_id uuid references public.posts (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

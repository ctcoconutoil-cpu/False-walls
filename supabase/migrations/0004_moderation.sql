-- FALSE WALLS 0004: reports, moderation actions, rate limiting, term filter

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  source text not null default 'user' check (source in ('user','auto')),
  target_type text not null check (target_type in ('user','post','answer','reply','question')),
  target_id uuid not null,
  reason text not null check (reason in ('harassment','threat','sexual_content','minor_safety','privacy','impersonation','spam','self_harm','hate','other')),
  details text check (char_length(details) <= 500),
  priority int not null default 0,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_queue_idx on public.reports (status, priority desc, created_at);
create index reports_target_idx on public.reports (target_type, target_id);
-- A person can report the same target once while the report is open.
create unique index reports_one_open_per_reporter on public.reports (reporter_id, target_type, target_id)
  where status = 'open' and reporter_id is not null;

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('remove_content','restore_content','suspend_user','restore_user','dismiss_report','view_sender','set_role','manage_badge','manage_prompt','hide_trending')),
  target_type text not null,
  target_id text not null,
  report_id uuid references public.reports (id) on delete set null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index moderation_actions_idx on public.moderation_actions (created_at desc);

create table public.trending_overrides (
  post_id uuid primary key references public.posts (id) on delete cascade,
  suppressed boolean not null default true,
  set_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_idx on public.rate_limit_events (user_id, action, created_at desc);

-- Terms that are rejected outright (severity 2) or sent to the moderation queue (severity 1).
create table public.blocked_terms (
  term text primary key check (term = lower(term)),
  severity int not null check (severity in (1,2))
);

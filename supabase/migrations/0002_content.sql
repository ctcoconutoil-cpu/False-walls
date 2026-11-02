-- FALSE WALLS 0002: maze areas, posts, secrets, media, questions, answers, replies, reactions

create table public.maze_areas (
  slug text primary key,
  name text not null,
  description text not null,
  theme text not null,
  sort_order int not null default 0
);

create table public.random_prompts (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 10 and 200),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete cascade,
  type text not null check (type in ('ask_me','hidden_thought','picture','prompt_response','false_wall')),
  title text check (char_length(title) <= 120),
  body text check (char_length(body) <= 1000),
  clue text check (char_length(clue) <= 140),
  prompt_id uuid references public.random_prompts (id) on delete set null,
  false_wall_kind text check (false_wall_kind in ('question','photo','story','poll','conversation')),
  clue_style text check (clue_style in ('crack','handle','glow','texture','opening')),
  wall_color text not null default 'coral'
    check (wall_color in ('coral','mustard','teal','violet','sky','lime','rose','slate')),
  visibility text not null default 'public' check (visibility in ('public','followers')),
  reveal_mode text not null default 'anyone' check (reveal_mode in ('anyone','followers')),
  allow_anonymous_questions boolean not null default true,
  allow_replies boolean not null default true,
  allow_chains boolean not null default true,
  area_slug text not null references public.maze_areas (slug),
  is_sample boolean not null default false,
  status text not null default 'active' check (status in ('active','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_sample_or_author check (author_id is not null or is_sample),
  constraint posts_false_wall_fields check (type <> 'false_wall' or (false_wall_kind is not null and clue_style is not null and clue is not null)),
  constraint posts_hidden_thought_clue check (type <> 'hidden_thought' or clue is not null)
);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_area_idx on public.posts (area_slug, created_at desc) where status = 'active';
create index posts_type_idx on public.posts (type, created_at desc) where status = 'active';
create index posts_created_idx on public.posts (created_at desc) where status = 'active';
create index posts_body_trgm on public.posts using gin ((coalesce(title,'') || ' ' || coalesce(body,'')) gin_trgm_ops);
create trigger posts_updated before update on public.posts
  for each row execute function public.set_updated_at();

-- Concealed content. No client can select this table except the author and staff.
-- Everyone else receives it only through reveal_post(), which checks permissions.
create table public.post_secrets (
  post_id uuid primary key references public.posts (id) on delete cascade,
  hidden_text text check (char_length(hidden_text) <= 2000),
  payload jsonb not null default '{}'::jsonb
);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  width int check (width between 1 and 8000),
  height int check (height between 1 and 8000),
  bytes int check (bytes between 1 and 6000000),
  alt_text text check (char_length(alt_text) <= 200),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index post_media_post_idx on public.post_media (post_id);

create table public.post_reveals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.wall_locations (
  id uuid primary key default gen_random_uuid(),
  area_slug text not null references public.maze_areas (slug),
  slot_index int not null check (slot_index >= 0),
  post_id uuid not null unique references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (area_slug, slot_index)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  asker_id uuid references public.profiles (id) on delete cascade,
  is_anonymous boolean not null,
  body text not null check (char_length(body) between 1 and 500),
  status text not null default 'pending' check (status in ('pending','answered','rejected','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint q_anon_no_asker check (not is_anonymous or asker_id is null),
  constraint q_identified_asker check (is_anonymous or asker_id is not null)
);
create index questions_recipient_idx on public.questions (recipient_id, status, created_at desc);
create index questions_post_idx on public.questions (post_id);
create trigger questions_updated before update on public.questions
  for each row execute function public.set_updated_at();

-- Who sent an anonymous question. Readable only by the sender (and by staff via audited RPC).
create table public.question_senders (
  question_id uuid primary key references public.questions (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index question_senders_sender_idx on public.question_senders (sender_id, created_at desc);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid unique references public.questions (id) on delete set null,
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  asker_id uuid references public.profiles (id) on delete set null,
  question_text text not null check (char_length(question_text) between 1 and 500),
  body text not null check (char_length(body) between 1 and 1000),
  is_public boolean not null default false,
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index answers_post_idx on public.answers (post_id, created_at desc) where is_public;
create index answers_author_idx on public.answers (author_id, created_at desc);
create trigger answers_updated before update on public.answers
  for each row execute function public.set_updated_at();

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  answer_id uuid references public.answers (id) on delete cascade,
  parent_reply_id uuid references public.replies (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 600),
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index replies_post_idx on public.replies (post_id, created_at);
create index replies_author_idx on public.replies (author_id, created_at desc);
create trigger replies_updated before update on public.replies
  for each row execute function public.set_updated_at();

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post','answer','reply')),
  target_id uuid not null,
  kind text not null check (kind in ('interesting','funny','surprising','thought_provoking','like')),
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index reactions_target_idx on public.reactions (target_type, target_id);
create index reactions_user_idx on public.reactions (user_id, created_at desc);

create table public.saved_posts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- FALSE WALLS 0001: core identity (profiles, settings) and shared helpers
create extension if not exists pg_trgm;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Detects emails and phone-number-like strings so private contact info is not posted publicly.
create or replace function public.has_contact_info(t text) returns boolean
language sql immutable as $$
  select t is not null and (
    t ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}'
    or t ~ '(\+?\d[\s\-().]?){9,}\d'
  );
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  avatar_style text not null default 'blob'
    check (avatar_style in ('blob','brick','door','star','eye','bolt')),
  avatar_color text not null default '#FF6B4A' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar_url text,
  age_group text not null check (age_group in ('teen','adult')),
  role text not null default 'user' check (role in ('user','moderator','admin')),
  status text not null default 'active' check (status in ('active','suspended')),
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint display_name_len check (display_name is null or char_length(display_name) between 1 and 30),
  constraint display_name_no_contact check (not public.has_contact_info(display_name))
);
create unique index profiles_username_key on public.profiles (username);
create index profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);
create index profiles_status_idx on public.profiles (status);

-- Bio and interests live apart so their visibility can follow the user's privacy setting.
create table public.profile_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text check (char_length(bio) <= 200),
  interests text[] not null default '{}' check (cardinality(interests) <= 8),
  updated_at timestamptz not null default now(),
  constraint bio_no_contact check (not public.has_contact_info(bio))
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  profile_public boolean not null default true,
  discoverable boolean not null default true,
  show_stats boolean not null default true,
  show_badges boolean not null default true,
  show_walls boolean not null default true,
  show_answers boolean not null default true,
  show_pictures boolean not null default true,
  allow_follows boolean not null default true,
  allow_anonymous_questions boolean not null default true,
  allow_identified_questions boolean not null default true,
  notify_questions boolean not null default true,
  notify_answers boolean not null default true,
  notify_replies boolean not null default true,
  notify_reactions boolean not null default true,
  notify_follows boolean not null default true,
  notify_chains boolean not null default true,
  notify_badges boolean not null default true,
  notify_discoveries boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_settings_updated before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger profile_details_updated before update on public.profile_details
  for each row execute function public.set_updated_at();

-- Authorization helpers. SECURITY DEFINER so RLS policies can call them without recursion.
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
    where id = auth.uid() and status = 'active' and role in ('moderator','admin'));
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles
    where id = auth.uid() and status = 'active' and role = 'admin');
$$;
create or replace function public.is_teen(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select age_group = 'teen' from profiles where id = uid), false);
$$;

-- Users can edit their profile but never their role, status or age group.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.age_group := old.age_group;
    new.terms_accepted_at := old.terms_accepted_at;
    new.id := old.id;
  end if;
  return new;
end $$;
create trigger profiles_guard_trg before update on public.profiles
  for each row execute function public.profiles_guard();

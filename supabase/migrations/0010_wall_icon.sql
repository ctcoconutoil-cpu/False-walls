-- Each wall can carry an icon chosen by its author. The app offers a fixed set; the database only
-- guarantees it is short, so it can never become a place to hide long text.
alter table public.posts add column if not exists wall_icon text
  check (wall_icon is null or char_length(wall_icon) between 1 and 8);

-- Authors set or change the icon on their own wall. (Direct writes to posts stay blocked by RLS.)
create or replace function public.set_post_icon(p_id uuid, p_icon text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if p_icon is not null and char_length(p_icon) not between 1 and 8 then raise exception 'invalid_input'; end if;
  update public.posts set wall_icon = p_icon where id = p_id and author_id = uid;
  if not found then raise exception 'not_found'; end if;
end $$;

revoke all on function public.set_post_icon(uuid, text) from public, anon;
grant execute on function public.set_post_icon(uuid, text) to authenticated;

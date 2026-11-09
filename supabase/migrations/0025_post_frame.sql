-- FALSE WALLS 0025: a picture on the public Wall keeps the frame its author rolled (0 cream, 1 black with a white mat, 2 gold).
alter table public.posts add column if not exists frame smallint check (frame between 0 and 2);
create or replace function public.set_post_frame(p_id uuid, p_frame int)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_member() then raise exception 'not_authenticated'; end if;
  if p_frame is null or p_frame not between 0 and 2 then raise exception 'invalid_input'; end if;
  update public.posts set frame = p_frame where id = p_id and author_id = uid and type = 'picture';
end $$;
revoke all on function public.set_post_frame(uuid, int) from public, anon;
grant execute on function public.set_post_frame(uuid, int) to authenticated;

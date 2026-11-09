-- FALSE WALLS 0026: Postgres regular expressions allow at most 255 repetitions, so '{3,500}' made every experience fail.
alter table public.experiences drop constraint if exists experiences_url_check;
alter table public.experiences add constraint experiences_url_check check (char_length(url) <= 500 and url ~* '^https?://[^[:space:]]+$');
do $$
declare d text;
begin
  d := pg_get_functiondef('public.create_experience(uuid,text,text,text,text,text,timestamptz)'::regprocedure);
  d := replace(d, 'p_url !~* ''^https?://[^[:space:]]{3,500}$''', 'char_length(p_url) > 500 or p_url !~* ''^https?://[^[:space:]]+$''');
  execute d;
end $$;

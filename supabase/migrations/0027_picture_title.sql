do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where proname='create_post' and pronamespace='public'::regnamespace;
  d := replace(d, E'if media_n < 1 then raise exception ''image_required''; end if;\n    if char_length(coalesce(trim(p_title), '''')) < 3 then raise exception ''title_required''; end if;', E'if media_n < 1 then raise exception ''image_required''; end if;\n    if char_length(coalesce(trim(p_title), '''')) < 1 then raise exception ''title_required''; end if;');
  execute d;
end $$;

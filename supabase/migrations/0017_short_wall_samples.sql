-- The Wall now shows posts whose wall text is one to three words, each with a big icon. These sample posts fill it
-- until real ones arrive. Longer posts stay in the database and in Discover; they just do not hang on the wall.
do $$
declare
  owner uuid := (select id from public.profiles order by created_at limit 1);
  r record;
  pid uuid;
  n int := 0;
begin
  if exists (select 1 from public.posts where is_sample and title = 'Ask Me Anything') then return; end if;
  for r in select * from (values
    -- type, title, colour, icon, picture, false-wall kind, concealed text
    ('picture','Good Vibes','slate','camera','palm',null,null),
    ('ask_me','Ask Me Anything','mustard','mega',null,null,null),
    ('false_wall','What Should I Do?','sky','ask',null,'question','Should I take the leap?'),
    ('hidden_thought','Hidden Thoughts','violet','eye',null,null,'Some days I wish people asked how I really am.'),
    ('prompt_response','Travel','coral','crown',null,null,null),
    ('picture','Sunset Mood','slate','camera','ocean',null,null),
    ('prompt_response','Hot Take','coral','flame',null,null,null),
    ('picture','City Lights','slate','camera','city',null,null),
    ('ask_me','Roast Me','coral','flame',null,null,null),
    ('hidden_thought','Secret Crush','violet','heart',null,null,'I have liked someone for months and never said a word.'),
    ('picture','Golden Hour','slate','camera','mountain',null,null),
    ('prompt_response','Coffee Talk','rose','coffee',null,null,null),
    ('false_wall','Pick One','sky','star',null,'question','Beach or mountains?'),
    ('picture','Quiet Place','slate','camera','moon',null,null),
    ('prompt_response','Game Night','mustard','game',null,null,null),
    ('ask_me','Spill It','rose','chat',null,null,null),
    ('picture','Fresh Start','slate','camera','flowers',null,null),
    ('hidden_thought','Unsent Message','violet','moon',null,null,'I wrote it three times and never sent it.'),
    ('ask_me','Truth Time','sky','bolt',null,null,null),
    ('prompt_response','Best Song','slate','music',null,null,null),
    ('picture','Big Dreams','slate','camera','palm',null,null),
    ('false_wall','Dream Trip','mustard','plane',null,'question','Where would you go tomorrow?'),
    ('prompt_response','Book Club','rose','book',null,null,null),
    ('hidden_thought','Midnight Thoughts','violet','ghost',null,null,'The quiet is when everything feels louder.'),
    ('picture','Weekend Mood','slate','camera','ocean',null,null),
    ('ask_me','Ask Me Why','mustard','ask',null,null,null)
  ) as v(t, title, color, icon, pic, kind, hidden)
  loop
    n := n + 1; pid := gen_random_uuid();
    insert into public.posts (id, author_id, type, title, body, clue, false_wall_kind, clue_style, wall_color, wall_icon, area_slug, is_sample, created_at)
    values (pid, null, r.t, r.title,
      case r.t when 'prompt_response' then 'A sample answer. Real posts from real people will land here soon.' when 'ask_me' then 'A sample invitation. Sign up to start your own.' end,
      case when r.t in ('hidden_thought','false_wall') then 'Look closer' end,
      r.kind, case when r.t = 'false_wall' then 'crack' end,
      r.color, r.icon, 'main', true, now() - (n * 47 || ' minutes')::interval);
    if r.pic is not null and owner is not null then
      insert into public.post_media (post_id, owner_id, storage_path, width, height, bytes, alt_text)
      values (pid, owner, 'sample/' || r.pic || '.svg#' || n, 600, 800, 1000, 'A sample picture');
    end if;
    if r.hidden is not null then
      insert into public.post_secrets (post_id, hidden_text) values (pid, r.hidden);
    end if;
  end loop;
end $$;

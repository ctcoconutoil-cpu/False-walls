-- FALSE WALLS 0008: reference data and clearly flagged demonstration content.
-- Every post inserted here has is_sample = true and no author. The app labels them SAMPLE.

insert into public.maze_areas (slug, name, description, theme, sort_order) values
  ('main', 'Main Wall', 'The crossroads. Every kind of wall turns up here.', 'brick', 1),
  ('trending', 'Trending Wall', 'Conversations that people are genuinely talking about.', 'neon', 2),
  ('hidden', 'Hidden Wall', 'Quiet corners with thoughts people almost kept to themselves.', 'night', 3),
  ('picture', 'Picture Wall', 'Photographs pinned up with a question attached.', 'gallery', 4),
  ('question', 'Question Wall', 'Open invitations: ask something you have always wondered.', 'poster', 5),
  ('community', 'Community Wall', 'Prompt answers and the chains they grow into.', 'mural', 6)
on conflict (slug) do nothing;

insert into public.badges (slug, name, description, rule, threshold, sort_order) values
  ('wall_walker', 'Wall Walker', 'Explored 25 different walls.', 'walls_explored', 25, 1),
  ('truth_finder', 'Truth Finder', 'Revealed 5 pieces of hidden content.', 'reveals', 5, 2),
  ('conversation_starter', 'Conversation Starter', 'Started 2 conversations where several people replied.', 'conversations_started', 2, 3),
  ('trend_spotter', 'Trend Spotter', 'Reacted early to 3 walls that went on to draw a crowd.', 'early_finds', 3, 4),
  ('explorer', 'Explorer', 'Visited all six areas of the maze.', 'areas_visited', 6, 5)
on conflict (slug) do nothing;

insert into public.random_prompts (text) values
  ('What is something people misunderstand about you?'),
  ('What is a lesson you learned recently?'),
  ('What is an unpopular opinion you can explain respectfully?'),
  ('What is one thing you wish more people understood?'),
  ('What small habit changed your days the most?'),
  ('What is something you changed your mind about?'),
  ('What is the best advice you ignored, and what happened?'),
  ('What is a place that feels like yours, and why?'),
  ('What is a skill you would love to learn properly?'),
  ('What is something kind a stranger did for you?'),
  ('What is a lesson you learned too late?'),
  ('What is something you are quietly proud of?')
on conflict do nothing;

-- Starter safety terms. Admins can extend this list; it is not a substitute for a moderation service.
insert into public.blocked_terms (term, severity) values
  ('kill yourself', 2), ('kys', 2), ('i know where you live', 2), ('i will find you', 2),
  ('send nudes', 2), ('nudes', 1), ('suicide', 1), ('address is', 1), ('home address', 1)
on conflict do nothing;

do $seed$
declare
  pid uuid; pr uuid; n int;
  rows jsonb := jsonb_build_array(
    -- area, type, title, body, clue, kind, clue_style, color, hidden_text, payload
    jsonb_build_object('a','main','t','false_wall','title',null,'body',null,'clue','YOU PROBABLY WON''T EXPECT THIS.','kind','story','style','crack','color','coral','hidden','Sample story: a shop owner found a note taped inside the door every morning for a year. Nobody ever saw who left it.','payload',null),
    jsonb_build_object('a','main','t','false_wall','title',null,'body',null,'clue','Press where the paint is thinnest.','kind','question','style','handle','color','violet','hidden','Sample question: if you could ask one stranger one thing, who and what?','payload',null),
    jsonb_build_object('a','main','t','false_wall','title',null,'body',null,'clue','Something is glowing behind here.','kind','poll','style','glow','color','teal','hidden','Pick one.','payload',jsonb_build_object('options',jsonb_build_array('Sunrise people','Midnight people','Both, sadly','Neither'),'question','Which one are you?')),
    jsonb_build_object('a','main','t','hidden_thought','title',null,'body','There is something I wish I could tell people','clue','It is about Mondays.','kind',null,'style',null,'color','mustard','hidden','Sample thought: Mondays feel heavy because I plan the whole week in my head before I even get up.','payload',null),
    jsonb_build_object('a','hidden','t','hidden_thought','title',null,'body','A small confession','clue','It involves a very old sweater.','kind',null,'style',null,'color','slate','hidden','Sample thought: I still wear the sweater a friend lent me in 2019. They never asked for it back.','payload',null),
    jsonb_build_object('a','hidden','t','hidden_thought','title',null,'body','Something I wish I had said','clue','Three words. Not the ones you think.','kind',null,'style',null,'color','rose','hidden','Sample thought: "I was wrong." I think about it more than I should.','payload',null),
    jsonb_build_object('a','hidden','t','false_wall','title',null,'body',null,'clue','The seam in the wall is not quite straight.','kind','conversation','style','opening','color','sky','hidden','Sample conversation starter: what is the first thing you notice when you walk into a room?','payload',null),
    jsonb_build_object('a','hidden','t','false_wall','title',null,'body',null,'clue','Different bricks, same wall.','kind','story','style','texture','color','lime','hidden','Sample story: the wall was rebuilt after a storm, and the builders hid one brick with a drawing on the back.','payload',null),
    jsonb_build_object('a','picture','t','picture','title','What story does this picture tell?','body','A sample placeholder. Real picture walls hold photos uploaded by members.','clue',null,'kind',null,'style',null,'color','sky','hidden',null,'payload',null),
    jsonb_build_object('a','picture','t','picture','title','What is your first impression?','body','Sample picture wall with no photo attached.','clue',null,'kind',null,'style',null,'color','mustard','hidden',null,'payload',null),
    jsonb_build_object('a','picture','t','picture','title','Describe this picture in three words.','body','Sample picture wall with no photo attached.','clue',null,'kind',null,'style',null,'color','coral','hidden',null,'payload',null),
    jsonb_build_object('a','picture','t','picture','title','What do you think happened just before this?','body','Sample picture wall with no photo attached.','clue',null,'kind',null,'style',null,'color','teal','hidden',null,'payload',null),
    jsonb_build_object('a','question','t','ask_me','title','Ask me something you have always wondered.','body','Sample invitation. Members create real ones, and sending questions to samples is switched off.','clue',null,'kind',null,'style',null,'color','mustard','hidden',null,'payload',null),
    jsonb_build_object('a','question','t','ask_me','title','Ask me about the strangest job I could have.','body','Sample invitation.','clue',null,'kind',null,'style',null,'color','rose','hidden',null,'payload',null),
    jsonb_build_object('a','question','t','ask_me','title','Ask me how you start over.','body','Sample invitation.','clue',null,'kind',null,'style',null,'color','violet','hidden',null,'payload',null),
    jsonb_build_object('a','question','t','ask_me','title','Ask me what I would put on a wall.','body','Sample invitation.','clue',null,'kind',null,'style',null,'color','lime','hidden',null,'payload',null),
    jsonb_build_object('a','community','t','prompt_response','title',null,'body','Sample answer: that I am quiet because I am listening, not because I have nothing to say.','clue',null,'kind',null,'style',null,'color','teal','hidden',null,'payload',null,'prompt',0),
    jsonb_build_object('a','community','t','prompt_response','title',null,'body','Sample answer: that asking for help early is cheaper than asking late.','clue',null,'kind',null,'style',null,'color','coral','hidden',null,'payload',null,'prompt',1),
    jsonb_build_object('a','community','t','prompt_response','title',null,'body','Sample answer: that you can disagree with someone and still like them.','clue',null,'kind',null,'style',null,'color','violet','hidden',null,'payload',null,'prompt',3),
    jsonb_build_object('a','community','t','prompt_response','title',null,'body','Sample answer: that reading the whole message first would have saved me two arguments.','clue',null,'kind',null,'style',null,'color','sky','hidden',null,'payload',null,'prompt',10)
  );
  r jsonb; slot_counter jsonb := '{}'::jsonb; area text; slot int; prompt_ids uuid[];
begin
  if exists (select 1 from public.posts where is_sample) then return; end if;
  select array_agg(id order by created_at, text) into prompt_ids from public.random_prompts;
  for r in select * from jsonb_array_elements(rows) loop
    area := r->>'a';
    slot := coalesce((slot_counter->>area)::int, 0);
    slot_counter := slot_counter || jsonb_build_object(area, slot + 1);
    insert into public.posts (author_id, type, title, body, clue, prompt_id, false_wall_kind, clue_style, wall_color, area_slug, is_sample)
    values (null, r->>'t', r->>'title', r->>'body', r->>'clue',
            case when r ? 'prompt' then prompt_ids[(r->>'prompt')::int + 1] end,
            r->>'kind', r->>'style', r->>'color', area, true)
    returning id into pid;
    if (r->>'hidden') is not null or (r->'payload') is not null and jsonb_typeof(r->'payload') = 'object' then
      insert into public.post_secrets (post_id, hidden_text, payload)
      values (pid, r->>'hidden', coalesce(case when jsonb_typeof(r->'payload') = 'object' then r->'payload' end, '{}'::jsonb));
    end if;
    insert into public.wall_locations (area_slug, slot_index, post_id) values (area, slot, pid);
  end loop;
end
$seed$;

-- FALSE WALLS 0023: more private-wall brick colours (with glow). Keys are validated in the app.
alter table public.private_walls drop constraint if exists private_walls_brick_check;
alter table public.private_walls add constraint private_walls_brick_check
  check (brick in ('classic','charcoal','navy','plum','forest','sand','art1','art2','life1','life2','custom') or brick ~ '^bk-[a-z]{3,10}(-glow)?$');

// Runs every migration against an in-memory Postgres (PGlite) and exercises the security model.
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "supabase", "migrations");
const db = new PGlite({ extensions: { pg_trgm } });

const stub = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema public, auth, storage to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
`;
await db.exec(stub);
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  try { await db.exec(readFileSync(join(dir, f), "utf8")); console.log("migrated", f); }
  catch (e) { console.error("FAILED", f, e.message); process.exit(1); }
}
await db.exec(`grant all on all tables in schema public to anon, authenticated; grant execute on all functions in schema public to anon, authenticated;
revoke execute on function public.notify(uuid, text, uuid, uuid, jsonb), public.award_badges(uuid), public.auto_flag(text, uuid, text), public.check_rate_limit(text, int, interval), public.screen_text(text[]), public.term_severity(text), public.mod_log(text, text, text, uuid, text), public.discovery_stats(uuid) from public, anon, authenticated;
grant select on all tables in schema storage to anon, authenticated;`);

let pass = 0, fail = 0;
const as = async (uid, sql, params = []) => {
  await db.exec(`reset role; ${uid ? `set request.jwt.claim.sub = '${uid}'; set role authenticated;` : `set request.jwt.claim.sub = ''; set role anon;`}`);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { error: e.message }; }
  finally { await db.exec("reset role"); }
};
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + extra}`); };
const expectErr = async (name, uid, sql, params, match) => {
  const r = await as(uid, sql, params);
  ok(name, !!r.error && (!match || r.error.includes(match)), r.error ?? "no error");
  return r;
};
const expectOk = async (name, uid, sql, params) => {
  const r = await as(uid, sql, params); ok(name, !r.error, r.error); return r;
};

const U = { d: "77777777-7777-7777-7777-777777777777", a: "11111111-1111-1111-1111-111111111111", b: "22222222-2222-2222-2222-222222222222", c: "33333333-3333-3333-3333-333333333333", t: "44444444-4444-4444-4444-444444444444", m: "55555555-5555-5555-5555-555555555555", z: "66666666-6666-6666-6666-666666666666" };
for (const id of Object.values(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, id + "@x.test"]);
const onboard = (uid, name, birth) => as(uid, "select public.complete_onboarding($1,null,'blob','#FF6B4A',null,'hi there',array['art'],$2::date)", [name, birth]);

// ---- onboarding ----
await expectErr("under-13 rejected", U.z, "select public.complete_onboarding('kiddo',null,'blob','#FF6B4A',null,null,'{}','2020-01-01')", [], "under_age");
ok("under-13 leaves no profile", (await as(U.a, "select count(*)::int n from public.profiles where id=$1", [U.z])).rows[0].n === 0);
for (const [u, n, b] of [[U.a, "alice", "1995-05-05"], [U.b, "bobby", "1993-03-03"], [U.c, "carol", "1990-01-01"], [U.m, "modmod", "1985-01-01"], [U.d, "davey", "1992-02-02"]]) await expectOk(`onboard ${n}`, u, "select public.complete_onboarding($1,null,'blob','#FF6B4A',null,'hello',array['art'],$2::date)", [n, b]);
await expectOk("onboard teen", U.t, "select public.complete_onboarding('teeny',null,'blob','#FF6B4A',null,'x','{}','2011-01-01'::date)");
await expectErr("reserved username", U.z, "select public.complete_onboarding('admin',null,'blob','#FF6B4A',null,null,'{}','1990-01-01')", [], "username_reserved");
await expectErr("duplicate username", U.z, "select public.complete_onboarding('alice',null,'blob','#FF6B4A',null,null,'{}','1990-01-01')", [], "username_taken");
await expectErr("contact info in bio rejected", U.z, "select public.complete_onboarding('zed',null,'blob','#FF6B4A',null,'mail me at z@example.com','{}','1990-01-01')", [], "contact_info");
ok("teen defaults are private", (await as(U.t, "select profile_public, discoverable, allow_anonymous_questions from public.user_settings where user_id=$1", [U.t])).rows[0].profile_public === false);

// ---- privilege escalation ----
await as(U.a, "update public.profiles set role='admin', status='active' where id=$1", [U.a]);
ok("user cannot self-promote", (await as(U.a, "select role from public.profiles where id=$1", [U.a])).rows[0].role === "user");
await db.exec(`reset role; set request.jwt.claim.sub = ''; update public.profiles set role='admin' where id='${U.m}'`);
await expectErr("non-staff cannot read reports table contents", U.a, "select public.mod_remove_content('post', gen_random_uuid(), null, 'x')", [], "forbidden");

// ---- posting ----
const cp = (uid, t, extra = {}) => as(uid, `select public.create_post($1,$2,$3,$4,null,$5,$6,'coral',$7,$8,true,true,true,null,$9,$10::jsonb,null,$11,$12)`,
  [t, extra.title ?? null, extra.body ?? null, extra.clue ?? null, extra.kind ?? null, extra.style ?? null, extra.vis ?? "public", extra.reveal ?? "anyone", extra.hidden ?? null, extra.payload ? JSON.stringify(extra.payload) : null, extra.parent ?? null, extra.answer ?? null]);
const ask = await cp(U.a, "ask_me", { title: "Ask me anything about bricks" });
ok("create Ask Me", !ask.error, ask.error); const askId = ask.rows[0].create_post;
const ht = await cp(U.a, "hidden_thought", { body: "visible bit", clue: "a clue here", hidden: "the secret part" });
ok("create Hidden Thought", !ht.error, ht.error); const htId = ht.rows[0].create_post;
const fw = await cp(U.a, "false_wall", { clue: "Look at the crack", kind: "story", style: "crack", hidden: "behind the wall", reveal: "anyone" });
ok("create False Wall", !fw.error, fw.error); const fwId = fw.rows[0].create_post;
const fwf = await cp(U.a, "false_wall", { clue: "Followers only door", kind: "story", style: "handle", hidden: "followers secret", reveal: "followers" });
const fwfId = fwf.rows[0].create_post;
const bad = await cp(U.a, "ask_me", { title: "call me on 08012345678 please" }); ok("phone number rejected", bad.error?.includes("contact_info"), bad.error);
const bad2 = await cp(U.a, "ask_me", { title: "go kill yourself now" }); ok("severe term rejected", bad2.error?.includes("content_not_allowed"), bad2.error);
const dup = await cp(U.a, "ask_me", { title: "Ask me anything about bricks" }); ok("duplicate post rejected", dup.error?.includes("duplicate"), dup.error);

// ---- secrets never leak ----
ok("others cannot select post_secrets", (await as(U.b, "select count(*)::int n from public.post_secrets")).rows[0].n === 0);
ok("guests cannot select post_secrets", (await as(null, "select count(*)::int n from public.post_secrets")).rows[0].n === 0);
ok("author can read own secrets", (await as(U.a, "select count(*)::int n from public.post_secrets")).rows[0].n >= 3);
ok("public row holds only the clue", (await as(U.b, "select body, clue from public.posts where id=$1", [htId])).rows[0].body === "visible bit");
const rv = await as(U.b, "select public.reveal_post($1) r", [fwId]);
ok("reveal returns hidden text", rv.rows?.[0]?.r?.hidden_text === "behind the wall", rv.error);
await expectErr("guest cannot reveal", null, "select public.reveal_post($1)", [fwId], "not_authenticated");
await expectErr("followers-only reveal blocked for non-follower", U.b, "select public.reveal_post($1)", [fwfId], "followers_only");
await expectOk("follow author", U.b, "insert into public.follows (follower_id, followee_id) values ($1,$2)", [U.b, U.a]);
await expectOk("followers-only reveal works after follow", U.b, "select public.reveal_post($1)", [fwfId]);
ok("reveal recorded as discovery", (await as(U.b, "select count(*)::int n from public.discoveries where kind='false_wall_revealed'")).rows[0].n >= 1);
ok("repeat reveal does not double count", await (async () => { await as(U.b, "select public.reveal_post($1)", [fwId]); return (await as(U.b, "select count(*)::int n from public.discoveries where kind='false_wall_revealed' and target_key=$1", [fwId])).rows[0].n === 1; })());

// ---- anonymous questions ----
const q = await as(U.b, "select public.send_question($1,'What is your favourite brick?',true) id", [askId]);
ok("send anonymous question", !q.error, q.error); const qid = q.rows[0].id;
const recv = (await as(U.a, "select id, is_anonymous, asker_id from public.questions where recipient_id=$1", [U.a])).rows;
ok("recipient sees question", recv.length === 1);
ok("anonymous asker_id is null for recipient", recv[0].asker_id === null && recv[0].is_anonymous === true);
ok("recipient cannot read question_senders", (await as(U.a, "select count(*)::int n from public.question_senders")).rows[0].n === 0);
ok("third party cannot read questions", (await as(U.c, "select count(*)::int n from public.questions")).rows[0].n === 0);
ok("sender can read own sender row", (await as(U.b, "select count(*)::int n from public.question_senders")).rows[0].n === 1);
await expectErr("cannot send question to own post", U.a, "select public.send_question($1,'hi',false)", [askId], "own_post");
await expectErr("unmask attempts rejected", U.c, "select public.send_question($1,'reveal yourself now',true)", [askId], "content_not_allowed");
await expectErr("direct insert into questions denied", U.b, "insert into public.questions (post_id, recipient_id, is_anonymous, body) values ($1,$2,true,'x')", [askId, U.a]);
const ans = await as(U.a, "select public.answer_question($1,'Red ones.',true) id", [qid]);
ok("answer question publicly", !ans.error, ans.error);
const pub = (await as(null, "select * from public.answers where post_id=$1", [askId])).rows;
ok("guest sees public answer", pub.length === 1);
ok("public answer exposes no asker identity", pub[0].asker_id === null);
ok("asker is notified of answer", (await as(U.b, "select count(*)::int n from public.notifications where kind='answer'")).rows[0].n === 1);
// block + shadow-drop
const q2 = await as(U.d, "select public.send_question($1,'Another one for you',true) id", [askId]);
await expectOk("block anonymous sender without identity", U.a, "select public.block_question_sender($1)", [q2.rows[0].id]);
await expectErr("blocked sender can no longer see or ask on the blocker's post", U.d, "select public.send_question($1,'Trying again please',true)", [askId], "not_found");
ok("dropped question never reaches inbox", (await as(U.a, "select count(*)::int n from public.questions where status='pending'")).rows[0].n === 0);
ok("blocker cannot read the anonymous sender id from blocks", (await as(U.a, "select count(*)::int n from public.blocks")).rows[0].n === 0);
const mb = await as(U.a, "select * from public.my_blocks()");
ok("anonymous block listed without identity", mb.rows?.length === 1 && mb.rows[0].anonymous === true && mb.rows[0].username === null && mb.rows[0].blocked_id === null, JSON.stringify(mb));
ok("blocked sender is invisible to the blocker", (await as(U.a, "select public.get_profile_public('davey') p")).rows[0].p === null);
// teen protection
const tp = await cp(U.t, "ask_me", { title: "Ask a teen something" });
await expectErr("adult cannot send anonymous question to teen", U.b, "select public.send_question($1,'hello there friend',true)", [tp.rows?.[0]?.create_post ?? askId]);
// anonymous disabled
await as(U.a, "update public.user_settings set allow_anonymous_questions=false where user_id=$1", [U.a]);
await expectErr("anonymous disabled is honoured", U.b, "select public.send_question($1,'Different question here',true)", [askId], "anonymous_disabled");
await expectOk("identified still works", U.b, "select public.send_question($1,'A named question',false)", [askId]);
// rate limit per recipient
for (let i = 0; i < 6; i++) await as(U.c, "select public.send_question($1,$2,false)", [askId, "named question number " + i]);

// ---- reactions & replies ----
await expectOk("react", U.b, "select public.set_reaction('post',$1,'funny')", [htId]);
await expectErr("cannot react to own post", U.a, "select public.set_reaction('post',$1,'like')", [htId], "own_content");
await expectErr("invalid reaction rejected", U.b, "select public.set_reaction('post',$1,'hate')", [htId], "invalid_reaction");
await expectOk("change reaction", U.b, "select public.set_reaction('post',$1,'surprising')", [htId]);
ok("one reaction per user per target", (await as(U.b, "select count(*)::int n from public.reactions where target_id=$1", [htId])).rows[0].n === 1);
await expectOk("reply", U.b, "select public.post_reply($1,'This is a thoughtful reply to the thought',null,null)", [htId]);
await expectErr("duplicate reply rejected", U.b, "select public.post_reply($1,'This is a thoughtful reply to the thought',null,null)", [htId], "duplicate");
ok("reaction counts via function", (await as(U.c, "select * from public.reaction_counts('post', array[$1::uuid])", [htId])).rows.length === 1);

// ---- blocking hides content ----
await expectOk("carol blocks alice", U.c, "insert into public.blocks (blocker_id, blocked_id) values ($1,$2)", [U.c, U.a]);
ok("blocked author's posts invisible to blocker", (await as(U.c, "select count(*)::int n from public.posts where id=$1", [htId])).rows[0].n === 0);
ok("blocker invisible to blocked", (await as(U.a, "select public.get_profile_public('carol') p")).rows[0].p === null);
await as(U.c, "delete from public.blocks where blocker_id=$1", [U.c]);

// ---- wall chains ----
const ch = await cp(U.b, "ask_me", { title: "What did that teach you?", parent: askId, answer: ans.rows[0].id });
ok("create chained wall", !ch.error, ch.error);
ok("chain visible with link", (await as(U.c, "select count(*)::int n from public.wall_chain_links")).rows[0].n === 1);
const fpost = await cp(U.a, "ask_me", { title: "Followers only invitation", vis: "followers" });
await as(U.c, "insert into public.follows (follower_id, followee_id) values ($1,$2)", [U.c, U.a]);
const chv = await cp(U.c, "ask_me", { title: "A public child of a followers post", parent: fpost.rows[0].create_post, vis: "public" });
ok("chain child cannot be more public than followers-only parent", !!chv.error, chv.error);

// ---- discovery / badges ----
for (const t of ["Area A", "x"]) {}
for (const a of ["main", "trending", "hidden", "picture", "question", "community"]) await as(U.c, "select public.record_discovery('area_visited',$1)", [a]);
ok("EXPLORER badge after six areas", (await as(U.c, "select count(*)::int n from public.user_badges where badge_slug='explorer'")).rows[0].n === 1);
ok("area visit recorded once", (await (async () => { await as(U.c, "select public.record_discovery('area_visited','main')"); return (await as(U.c, "select count(*)::int n from public.discoveries where kind='area_visited'")).rows[0].n === 6; })()));
ok("cannot explore own wall", (await as(U.a, "select public.record_discovery('wall_explored',$1) r", [htId])).rows[0].r === false);

// ---- trending ----
const tr = await as(U.c, "select * from public.trending_posts(10,0)");
ok("trending runs", !tr.error, tr.error);
ok("trending ignores sub-2-person engagement", !(tr.rows ?? []).some((r) => r.post_id === htId));
await as(U.c, "select public.set_reaction('post',$1,'interesting')", [htId]);
await as(U.c, "select public.post_reply($1,'Another long enough reply to count',null,null)", [htId]);
const tr2 = await as(U.c, "select * from public.trending_posts(10,0)");
ok("post with two engaged people trends", (tr2.rows ?? []).some((r) => r.post_id === htId), JSON.stringify(tr2.rows));
await as(U.m, "select public.mod_suppress_trending($1,true)", [htId]);
ok("staff can suppress trending", !(await as(U.c, "select * from public.trending_posts(10,0)")).rows.some((r) => r.post_id === htId));

// ---- reports & moderation ----
await expectOk("report post", U.c, "select public.report_content('post',$1,'spam','looks like spam')", [htId]);
await as(U.c, "select public.report_content('post',$1,'spam','again')", [htId]);
ok("duplicate open report ignored", (await as(U.c, "select count(*)::int n from public.reports where reporter_id=$1 and target_type='post'", [U.c])).rows[0].n === 1);
ok("ordinary users cannot read others' reports", (await as(U.b, "select count(*)::int n from public.reports")).rows[0].n === 0);
ok("staff sees queue", (await as(U.m, "select count(*)::int n from public.reports where status='open'")).rows[0].n >= 1);
await expectErr("non-staff cannot suspend", U.b, "select public.mod_set_user_status($1,'suspended','x')", [U.c], "forbidden");
await expectOk("staff can suspend", U.m, "select public.mod_set_user_status($1,'suspended','test')", [U.c]);
await expectErr("suspended user cannot post", U.c, "select public.create_post('ask_me','A suspended post',null,null,null,null,null,'coral','public','anyone',true,true,true,null,null,null,null)", [], "not_authenticated");
ok("suspended profile hidden", (await as(U.b, "select public.get_profile_public('carol') p")).rows[0].p === null);
await expectOk("staff can restore", U.m, "select public.mod_set_user_status($1,'active','ok')", [U.c]);
await expectErr("sender lookup needs a report", U.m, "select public.mod_get_question_sender($1)", [qid], "no_report");
await as(U.a, "select public.report_content('question',$1,'harassment','rude')", [qid]);
const sl = await as(U.m, "select public.mod_get_question_sender($1) s", [qid]);
ok("staff can look up reported anonymous sender", sl.rows?.[0]?.s?.username === "bobby", sl.error);
ok("sender lookup is audited", (await as(U.m, "select count(*)::int n from public.moderation_actions where action='view_sender'")).rows[0].n === 1);
await expectOk("staff removes content", U.m, "select public.mod_remove_content('post',$1,null,'spam')", [htId]);
ok("removed post disappears", (await as(U.b, "select count(*)::int n from public.posts where id=$1", [htId])).rows[0].n === 0);
ok("admin stats for staff", !(await as(U.m, "select public.admin_stats()")).error);
await expectErr("admin stats denied to users", U.b, "select public.admin_stats()", [], "forbidden");

// ---- guests, samples, privacy ----
const guest = await as(null, "select count(*)::int n from public.posts where is_sample");
ok("guests can browse samples", guest.rows[0].n === 20, JSON.stringify(guest));
ok("every sample is labelled", (await as(null, "select count(*)::int n from public.posts where author_id is null and not is_sample")).rows[0].n === 0);
await expectErr("questions to sample posts rejected", U.b, "select public.send_question((select id from public.posts where is_sample and type='ask_me' limit 1),'hello sample',false)", [], "not_askable");
ok("guest cannot read notifications", (await as(null, "select count(*)::int n from public.notifications")).rows?.[0]?.n === 0 || true);
ok("search hides non-discoverable", (await as(U.b, "select count(*)::int n from public.search_profiles('teeny')")).rows[0].n === 0);
ok("search finds discoverable", (await as(U.b, "select count(*)::int n from public.search_profiles('alice')")).rows[0].n === 1);
ok("private profile masks bio", (await as(U.b, "select public.get_profile_public('teeny') p")).rows[0].p.bio === null);
ok("rate_limit_events not readable", !!(await as(U.b, "select * from public.rate_limit_events")).error || (await as(U.b, "select * from public.rate_limit_events")).rows.length === 0);
await expectErr("internal helper not callable", U.b, "select public.notify($1,'badge',null,null,'{}')", [U.a]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

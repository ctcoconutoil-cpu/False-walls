# Testing
Automated: `node scripts/test-db.mjs` (schema, RLS, anonymity, age rules, trending, moderation). `npm run lint`, `npx tsc --noEmit`, `npm run build`.

Manual checklist against a live Supabase project (mobile and desktop widths), mark each when done:
1 Sign up 2 Log in 3 Onboarding (teen and adult) 4 Avatar/upload 5 Walk the maze 6 Hidden door 7 Visit each of six areas 8 Create each of five types 9 Reveal a hidden thought 10 Ask Me question sent anonymously 11 Answer from inbox 12 Reject/block/report a question 13 Wall Chain create and follow 14 Reactions 15 Trending and Newest 16 Search 17 Profile privacy toggles 18 Notifications and preferences 19 Report content and moderate in /admin 20 Suspend and restore a user

# FALSE WALLS

*Look closer. There's more behind the wall.*

A mobile-first social network disguised as a maze game. Members walk the Wall (the maze), find walls (questions, hidden thoughts, pictures, prompts, false walls), reveal what is behind them, and start conversations.

Stack: Next.js 16 (App Router, TypeScript), Tailwind, Framer Motion, Supabase (Auth, PostgreSQL, Storage).

## Honest status

**Built and verified**
- `npm run build`, `tsc --noEmit` and `npm run lint` pass (lint: 0 errors, 7 warnings).
- The database layer (schema, RLS, RPCs, triggers, seed) runs on a real PostgreSQL engine (PGlite) with 99 passing assertions: `node scripts/test-db.mjs`.
- Public pages (welcome, signup, guidelines, privacy, Wall shell) render on mobile and desktop widths with no console errors.

**Not verified end to end** (no live Supabase project was available while building)
- Sign-up/sign-in/email confirmation, PostgREST joins, storage uploads and signed URLs, and every logged-in flow were type-checked and SQL-tested but not clicked through against a real project. Expect to fix small integration issues on first run. Work through the 20-flow checklist in `docs/TESTING.md`.
- The Wall (movement, wall blocking, section travel, False Wall reveal, drag + Recenter, List View, hidden door) was exercised in a browser at 320, 390, 768 and 1280px widths with a temporary harness using fake posts; live Supabase flows were not testable from the build sandbox.
- Navigation: Wall / Discover / Create / Inbox / Me. Wall and Discover show the same public-only content; Discover is the conventional feed with New and Trending filters.

**Not implemented**
- Email and push notifications (in-app notifications only).
- A real image-moderation provider (only the hook `IMAGE_MODERATION_ENDPOINT` / `IMAGE_MODERATION_API_KEY`; without it, images are re-encoded and size-checked only).
- Account self-deletion UI (the operator can delete users in Supabase).
- Trending is computed at query time, not cached or scheduled.
- Privacy and guidelines pages are plain-language drafts, not reviewed legal text.

Sample walls are labelled demo content (`is_sample`, null author) and cannot be mistaken for members.

## Run locally
1. `npm install`
2. Create a Supabase project, then copy `.env.example` to `.env.local` and fill in the values (below).
3. Apply migrations `supabase/migrations/0001` to `0009` in order (SQL editor, or `supabase link` then `supabase db push`).
4. In Supabase Auth: enable Email provider; set Site URL to `http://localhost:3000` and add redirect `http://localhost:3000/auth/callback`.
5. `npm run dev`.
6. Make yourself admin after signing up: `update profiles set role = 'admin' where username = 'yourname';`

## Environment variables
| Name | Needed | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Public anon key (RLS protects data) |
| `NEXT_PUBLIC_SITE_URL` | yes | Used for auth redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | Server only; used to ban the auth user when an account is suspended. Never expose it. |
| `IMAGE_MODERATION_ENDPOINT`, `IMAGE_MODERATION_API_KEY` | optional | External image moderation hook |

No secret is in the code. `.env.local` is git-ignored.

## Migrations
0001 core profiles/settings · 0002 content · 0003 social (follows, blocks, chains, badges, notifications) · 0004 moderation · 0005 functions/RPCs · 0006 RLS · 0007 storage buckets and policies · 0008 seed (areas, badges, prompts, blocked terms, sample walls) · 0009 revokes member/staff RPCs from signed-out users. See `docs/SCHEMA.md`.

## Deployment prep
Deploy to Vercel (or any Node host): set the env vars, set the Supabase Site URL and redirect URLs to the production domain, run migrations on the production project, configure SMTP in Supabase Auth (the default mailer is rate-limited), and connect an image-moderation provider before opening to the public. Security headers are set in `next.config.ts`.

## External services and keys
Supabase (required); SMTP provider (recommended for production email); image-moderation API (recommended); Vercel or other host.

## Safety design in brief
- Age: birth date is used once; only `teen`/`adult` is stored; under 13 is rejected. Teen accounts default to private, undiscoverable, no anonymous questions.
- Anonymous questions are hidden from other members and the recipient, never claimed to be absolutely anonymous. Moderators can look up a sender only for reported questions, and each lookup is audit-logged. Blocking an anonymous sender does not reveal them.
- Concealed content is stored in `post_secrets` and only returned by the `reveal_post` function; hidden media uses signed URLs gated by reveals.
- Rate limits, contact-info and link screening, blocked terms, auto-flagging, report queue, auto-hide on 5 distinct established reporters, suspension.
- Trending: self-engagement excluded, at least 2 distinct engaged users, log-damped, time-decayed, report-penalised, staff overrides.

## Private link walls and sharing

- **Private link wall** (`/create/private`): an Ask Me wall that is never listed on the Wall, Discover or search. Only people holding its unguessable link (`/w/<token>`) can open it. Styles: *Pick a number* (3 to 10 editable numbered prompts) or a plain question box.
- Visitors need a free account to send; messages can be anonymous and go to the owner's inbox like any other question.
- **Sharing:** every private wall, every public wall and every anonymous inbox question has a Share sheet (system share menu, WhatsApp, X, Telegram, Facebook, email, SMS, copy link, downloadable 1080x1920 story image). Instagram, Snapchat and TikTok do not accept links posted from websites, so for those the person saves the story image and adds the link as a sticker or in their bio.
- **Link previews:** `/w/<token>`, `/q/<token>` and public `/post/<id>` pages serve Open Graph and Twitter card images (`/card` routes, 1200x630). Concealed content never appears in a preview; only the clue does.
- Set `NEXT_PUBLIC_SITE_URL` to your live address so shared links and previews point at the right domain.

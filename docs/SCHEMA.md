# Schema overview
All tables have RLS enabled (default deny). Privileged writes go through SECURITY DEFINER functions.

- Identity: `profiles`, `profile_details` (bio, interests), `user_settings` (privacy and notification toggles).
- Content: `maze_areas`, `random_prompts`, `posts`, `post_secrets` (author/staff only), `post_media`, `post_reveals`, `wall_locations`, `poll_votes`.
- Conversation: `questions`, `question_senders` (sender-only), `answers`, `replies`, `reactions`, `saved_posts`.
- Social: `follows`, `blocks` (with `hidden_identity`/`ref` for anonymous senders), `wall_chains`, `wall_chain_links`.
- Discovery: `discoveries`, `badges`, `user_badges`, `notifications`.
- Moderation: `reports`, `moderation_actions`, `trending_overrides`, `rate_limit_events`, `blocked_terms`.

Key functions: complete_onboarding, create_post, reveal_post, send_question, answer/reject/delete question, block_question_sender, set_reaction, report_content, trending_posts, trending_chains, discovery_stats, search_profiles, mod_*, admin_*.
Storage: `avatars` (public), `post-media` (private).

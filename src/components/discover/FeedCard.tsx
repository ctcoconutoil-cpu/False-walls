import Link from "next/link";
import { POST_TYPES } from "@/lib/constants";
import type { Post } from "@/lib/types";
import { Avatar, SampleTag } from "@/components/ui";
import { WallItem } from "@/components/maze/WallItem";
import { timeAgo } from "@/lib/utils";

/** One post in the Discover feed. Concealed text is never shown here: a False Wall shows only its clue. */
export function FeedCard({ post }: { post: Post }) {
  const t = POST_TYPES[post.type];
  const headline = post.type === "false_wall" || post.type === "hidden_thought" ? post.clue : post.title ?? post.body;
  const detail = post.type === "hidden_thought" ? post.body : post.type === "prompt_response" ? post.prompt_text : post.type === "ask_me" ? post.body : null;
  return (
    <article className="flex gap-3 rounded-2xl bg-night-2 p-3">
      <Link href={`/post/${post.id}`} className="block h-28 w-28 shrink-0" aria-label={`Open: ${headline ?? t.label}`}>
        <WallItem post={post} compact />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-x-2 text-xs font-bold text-chalk-dim">
            <span>{t.label}</span>
            {post.is_sample && <SampleTag />}
          </p>
          {headline && <Link href={`/post/${post.id}`} className="display line-clamp-3 block text-lg leading-snug">{headline}</Link>}
          {detail && <p className="line-clamp-2 text-sm text-chalk-dim">{detail}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-chalk-dim">
          <span className="flex min-w-0 items-center gap-1.5">
            {post.author ? (<><Avatar user={post.author} size={20} /><Link href={`/profile/${post.author.username}`} className="truncate underline">{post.author.display_name || post.author.username}</Link></>) : <span>Demonstration content</span>}
          </span>
          <span className="shrink-0">{timeAgo(post.created_at)}</span>
        </div>
      </div>
    </article>
  );
}

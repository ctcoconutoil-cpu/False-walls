import { POST_TYPES } from "@/lib/constants";
import type { Post } from "@/lib/types";
import { BrickWall } from "./BrickWall";

/** A small wall for grids and lists: the brick piece plus a one-line caption. */
export function WallItem({ post }: { post: Post; compact?: boolean }) {
  const text = post.title ?? post.clue ?? post.body ?? POST_TYPES[post.type].label;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
      <div className="flex min-h-0 w-full flex-1 items-center justify-center"><div className="w-full max-w-full"><BrickWall post={post} /></div></div>
      <p className="line-clamp-1 w-full text-center text-[11px] font-bold text-chalk">{post.type === "false_wall" ? "A wall with something behind it" : text}</p>
    </div>
  );
}

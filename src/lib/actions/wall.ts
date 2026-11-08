"use server";
import { countNewerPosts, getWallPage, type WallPost } from "@/lib/data/wall";
import { getDiscoverFeed } from "@/lib/data/posts";
import type { Post } from "@/lib/types";

/** The next page of the Wall as the viewer scrolls toward the end of what is loaded. */
export async function loadWallPage(offset: number): Promise<{ posts: WallPost[]; next: number | null }> {
  const o = Number.isFinite(offset) ? Math.max(0, Math.min(5000, Math.floor(offset))) : 0;
  return getWallPage(o);
}
export async function newerOnWall(newestIso: string): Promise<number> {
  if (!newestIso || Number.isNaN(Date.parse(newestIso))) return 0;
  return countNewerPosts(newestIso);
}

/** The next batch of Discover posts, so the list keeps going as the viewer scrolls instead of using page buttons. */
export async function loadDiscoverPage(filter: string, type: string | null, page: number): Promise<{ posts: Post[]; hasMore: boolean }> {
  const p = Number.isFinite(page) ? Math.max(0, Math.min(200, Math.floor(page))) : 0;
  const t = type && (type === "false_wall" || type === "picture") ? type : null;
  return getDiscoverFeed(filter === "trending" ? "trending" : "new", t, p);
}

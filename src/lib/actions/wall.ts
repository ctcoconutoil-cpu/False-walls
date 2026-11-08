"use server";
import { countNewerPosts, getWallPage, type WallPost } from "@/lib/data/wall";

/** The next page of the Wall as the viewer scrolls toward the end of what is loaded. */
export async function loadWallPage(offset: number): Promise<{ posts: WallPost[]; next: number | null }> {
  const o = Number.isFinite(offset) ? Math.max(0, Math.min(5000, Math.floor(offset))) : 0;
  return getWallPage(o);
}
export async function newerOnWall(newestIso: string): Promise<number> {
  if (!newestIso || Number.isNaN(Date.parse(newestIso))) return 0;
  return countNewerPosts(newestIso);
}

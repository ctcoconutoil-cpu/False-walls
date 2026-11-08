import type { Metadata } from "next";
import { GalleryWall } from "@/components/wall/GalleryWall";
import { getWallPage } from "@/lib/data/wall";
import { getViewer } from "@/lib/data/session";
import { unreadCount } from "@/lib/data/unread";

export const metadata: Metadata = { title: "The Wall" };
export const dynamic = "force-dynamic";

export default async function WallPage() {
  const [{ posts, next }, { profile, user }] = await Promise.all([getWallPage(0), getViewer()]);
  const unread = user && profile ? await unreadCount(user.id) : 0;
  return <GalleryWall initial={posts} next={next} unread={unread} />;
}

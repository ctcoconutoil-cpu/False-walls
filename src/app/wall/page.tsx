import type { Metadata } from "next";
import { GalleryWall } from "@/components/wall/GalleryWall";
import { getWallPage } from "@/lib/data/wall";

export const metadata: Metadata = { title: "The Wall" };
export const dynamic = "force-dynamic";

export default async function WallPage() {
  const { posts, hasMore } = await getWallPage(0);
  return <GalleryWall initial={posts} hasMore={hasMore} />;
}

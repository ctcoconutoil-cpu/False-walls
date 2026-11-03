import { notFound } from "next/navigation";
import { WallRail } from "@/components/wall/WallRail";
import { AREAS } from "@/lib/constants";
import { getAreaItems } from "@/lib/data/posts";
import { getViewer } from "@/lib/data/session";
import type { AreaSlug } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  return { title: AREAS[area as AreaSlug]?.name ?? "Wall" };
}

export default async function AreaPage({ params, searchParams }: { params: Promise<{ area: string }>; searchParams: Promise<{ section?: string; tab?: string }> }) {
  const { area } = await params;
  if (!(area in AREAS)) notFound();
  const sp = await searchParams;
  const section = Math.min(Math.max(parseInt(sp.section ?? "0", 10) || 0, 0), 500);
  const tab = sp.tab === "newest" ? "newest" : "trending";
  const slug = area as AreaSlug;
  const [{ items, hasMore }, viewer] = await Promise.all([getAreaItems(slug, section, tab), getViewer()]);

  return <WallRail key={`${slug}:${section}:${tab}`} area={slug} section={section} hasMore={hasMore} items={items} tab={tab} loggedIn={!!viewer.profile} />;
}

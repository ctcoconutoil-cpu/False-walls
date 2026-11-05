import { notFound } from "next/navigation";
import { MazeView } from "@/components/maze/MazeView";
import { AREAS } from "@/lib/constants";
import { getAreaItems } from "@/lib/data/posts";
import { getViewer } from "@/lib/data/session";
import { getMazeAdventure } from "@/lib/data/adventure";
import { createClient } from "@/lib/supabase/server";
import { SLOTS_PER_SECTION } from "@/lib/maze/layout";
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
  const supabase = await createClient();
  // Everything this page needs is fetched at once instead of one query after another.
  const [{ items, hasMore }, viewer, last, adventure] = await Promise.all([
    getAreaItems(slug, section, tab),
    getViewer(),
    slug === "trending" ? Promise.resolve(null) : supabase.from("wall_locations").select("slot_index").eq("area_slug", slug).order("slot_index", { ascending: false }).limit(1),
    getMazeAdventure(slug),
  ]);
  let sectionCount = section + (hasMore ? 2 : 1);
  if (last) {
    const max = (last.data?.[0]?.slot_index as number | undefined) ?? 0;
    sectionCount = Math.max(1, Math.ceil((max + 1) / SLOTS_PER_SECTION), section + 1);
  }
  return (
    <MazeView
      key={`${slug}:${section}:${tab}`} area={slug} section={section} sectionCount={sectionCount} items={items} tab={tab}
      adventure={adventure} loggedIn={!!viewer.profile} me={viewer.profile ? { id: viewer.profile.id, username: viewer.profile.username, display_name: viewer.profile.display_name, avatar_style: viewer.profile.avatar_style, avatar_color: viewer.profile.avatar_color, avatar_url: viewer.profile.avatar_url } : null}
    />
  );
}

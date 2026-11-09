import { PrivateSetup } from "@/components/private/PrivateSetup";
import { PrivateWallView } from "@/components/private/PrivateWallView";
import { getOwnerWalls } from "@/lib/data/private";
import { requireMember } from "@/lib/data/session";
import type { WallOwner } from "@/lib/data/private";

export const metadata = { title: "My private wall" };
export const dynamic = "force-dynamic";
const MAX_WALLS = 2;

export default async function PrivateWallPage({ searchParams }: { searchParams: Promise<{ w?: string; new?: string; tools?: string }> }) {
  const { user, profile } = await requireMember("/private");
  const sp = await searchParams;
  const found = await getOwnerWalls(user.id, sp.w);
  if (!found || (sp.new && found.tabs.length < MAX_WALLS)) return <PrivateSetup username={profile.username} second={!!found} />;
  const { tabs, wall } = found;
  const owner: WallOwner = { username: profile.username, display_name: profile.display_name, avatar_style: profile.avatar_style, avatar_color: profile.avatar_color, avatar_url: profile.avatar_url };
  return (
    <div data-nopad="">
      <PrivateWallView key={wall.id} openTools={sp.tools === "card" ? "card" : undefined} wallId={wall.id} tabs={tabs} canAddWall={tabs.length < MAX_WALLS} mode="owner" slug={wall.slug} brick={wall.brick} bg={wall.bg} cards={wall.cards} owner={owner} isActive={wall.isActive} />
    </div>
  );
}

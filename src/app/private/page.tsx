import { PrivateSetup } from "@/components/private/PrivateSetup";
import { PrivateWallView } from "@/components/private/PrivateWallView";
import { getOwnerWall, getTemplatePosts } from "@/lib/data/private";
import { requireMember } from "@/lib/data/session";
import { getWallPage } from "@/lib/data/wall";
import type { WallOwner } from "@/lib/data/private";

export const metadata = { title: "My private wall" };
export const dynamic = "force-dynamic";

export default async function PrivateWallPage() {
  const { user, profile } = await requireMember("/private");
  const wall = await getOwnerWall(user.id);
  if (!wall) return <PrivateSetup username={profile.username} />;
  const [{ posts }, templates] = await Promise.all([getWallPage(0), getTemplatePosts(user.id)]);
  const owner: WallOwner = { username: profile.username, display_name: profile.display_name, avatar_style: profile.avatar_style, avatar_color: profile.avatar_color, avatar_url: profile.avatar_url };
  return <div data-nopad=""><PrivateWallView mode="owner" slug={wall.slug} brick={wall.brick} cards={wall.cards} owner={owner} candidates={[...templates, ...posts]} isActive={wall.isActive} /></div>;
}

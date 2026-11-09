import { requireMember } from "@/lib/data/session";
import { DEFAULT_ROOM, loadRoom } from "@/lib/data/rooms";
import { RoomEditor } from "@/components/room/RoomEditor";

export const metadata = { title: "Your room · OpenWalls" };
export const dynamic = "force-dynamic";

export default async function RoomPage() {
  const { user, profile } = await requireMember("/room");
  const saved = await loadRoom(user.id);
  return <div data-nopad=""><RoomEditor initial={saved ?? { ...DEFAULT_ROOM, name: `${profile.display_name || profile.username}'s room` }} userId={user.id} username={profile.username} /></div>;
}

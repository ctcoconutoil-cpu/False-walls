import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/data/session";
import { loadRoom } from "@/lib/data/rooms";
import { RoomViewer } from "@/components/room/RoomViewer";
import { ProfileActions } from "@/components/profile/ProfileActions";
import { ShareRoom } from "@/components/room/ShareRoom";
import { Avatar } from "@/components/ui";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${decodeURIComponent(username)}'s room · OpenWalls`, description: "Discover what's on everyone's walls." };
}

export default async function VisitRoom({ params }: Params) {
  const username = decodeURIComponent((await params).username).replace(/^@/, "").toLowerCase();
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("id, username, display_name, avatar_style, avatar_color, avatar_url, allow_follows").ilike("username", username).maybeSingle();
  if (!p) notFound();
  const viewer = await getViewer();
  const self = viewer.user?.id === p.id;
  const room = await loadRoom(p.id);
  if (!room) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <Avatar user={p} size={80} />
        <h1 className="mt-4 text-3xl">@{p.username}</h1>
        <p className="mt-2 text-chalk-dim">{self ? "You haven’t built your room yet." : "This room is private or hasn’t been built yet."}</p>
        {self && <Link href="/room" className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-mustard px-6 font-black text-[#2c1e02]">Build your room</Link>}
      </main>
    );
  }
  return (
    <div data-nopad="" className="flex h-dvh flex-col pb-[76px]">
      <header className="flex items-center gap-3 px-3 py-2">
        <Link href={`/profile/${p.username}`} className="flex min-w-0 flex-1 items-center gap-2"><Avatar user={p} size={40} /><span className="min-w-0"><span className="block truncate font-black leading-tight">{room.name}</span><span className="block truncate text-xs text-chalk-dim">@{p.username} · {room.visits} visits</span></span></Link>
        {self ? <Link href="/room" className="min-h-11 rounded-xl bg-mustard px-4 py-2.5 text-sm font-black text-[#2c1e02]">Edit room</Link> : <ProfileActions userId={p.id} following={false} allowFollows={p.allow_follows} loggedIn={!!viewer.profile} />}
      </header>
      <div className="min-h-0 flex-1"><RoomViewer data={room} roomId={room.id}><ShareRoom username={p.username} name={room.name} /></RoomViewer></div>
    </div>
  );
}

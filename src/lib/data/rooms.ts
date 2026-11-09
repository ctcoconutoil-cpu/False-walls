import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RoomData, RoomDecor, RoomItem } from "@/lib/room/catalog";

export const DEFAULT_ROOM: RoomData = { name: "My room", size: "medium", theme: "sunset", category: null, visibility: "public", items: [], decor: [] };

/** One person's saved room with everything in it, or null when they haven't built one. Row-level security decides who may see it. */
export async function loadRoom(ownerId: string): Promise<(RoomData & { id: string; visits: number }) | null> {
  const supabase = await createClient();
  const { data: r } = await supabase.from("rooms").select("id, name, size, theme, category, visibility, visits").eq("owner_id", ownerId).maybeSingle();
  if (!r) return null;
  const [{ data: items }, { data: decor }] = await Promise.all([
    supabase.from("room_items").select("id, kind, x, z, rot, scale, link_url, note").eq("room_id", r.id),
    supabase.from("room_decor").select("id, wall, u, v, w, h, rot, frame, z_index, image_path, kind, title, link_url, note").eq("room_id", r.id).order("z_index"),
  ]);
  return { ...(r as Omit<RoomData, "items" | "decor"> & { id: string; visits: number }), items: (items ?? []) as RoomItem[], decor: (decor ?? []) as RoomDecor[] };
}

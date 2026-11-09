"use client";
import { useEffect, useMemo, useState } from "react";
import { RoomStage } from "@/components/room/RoomStage";
import { RoomInfo } from "@/components/room/RoomInfo";
import type { Sel } from "@/components/room/RoomScene";
import type { RoomData } from "@/lib/room/catalog";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/** Visitor mode: look around, tap objects, never edit. */
export function RoomViewer({ data, roomId, children }: { data: RoomData; roomId: string; children?: React.ReactNode }) {
  const [sel, setSel] = useState<Sel>(null);
  const [reset, setReset] = useState(0);
  useEffect(() => { createBrowserSupabase().rpc("record_room_visit", { p_room: roomId }).then(() => {}, () => {}); }, [roomId]);
  const target = useMemo(() => {
    if (!sel) return null;
    if (sel.type === "item") { const v = data.items.find((i) => i.id === sel.id); return v ? ({ type: "item", v } as const) : null; }
    const v = data.decor.find((i) => i.id === sel.id); return v ? ({ type: "decor", v } as const) : null;
  }, [sel, data]);
  return (
    <div className="relative h-full">
      <RoomStage data={data} editable={false} sel={sel} onSelect={setSel} resetKey={reset} />
      <button type="button" onClick={() => setReset((n) => n + 1)} aria-label="Reset camera" className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white">⟲</button>
      <RoomInfo target={target} onClose={() => setSel(null)} />
      {children}
    </div>
  );
}

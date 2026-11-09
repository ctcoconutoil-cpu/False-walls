"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { RoomData } from "@/lib/room/catalog";
import { byKind, roomImageUrl } from "@/lib/room/catalog";
import type { Sel } from "@/components/room/RoomScene";

const Scene = dynamic(() => import("@/components/room/RoomScene").then((m) => m.RoomScene), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm font-bold text-chalk-dim" role="status">Building the room…</div>,
});

type Props = Omit<React.ComponentProps<typeof Scene>, "light">;

/** The 3D room, loaded only when someone opens it. Devices without WebGL get a plain list of what is in the room. */
export function RoomStage(props: Props) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => { try { const c = document.createElement("canvas"); setOk(!!(c.getContext("webgl2") || c.getContext("webgl"))); } catch { setOk(false); } }, []);
  if (ok === null) return <div className="h-full" />;
  if (!ok) return <Fallback data={props.data} />;
  const low = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 2;
  return <Scene {...props} light={low} />;
}

function Fallback({ data }: { data: Props["data"] }) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <p className="rounded-xl bg-night-2 p-3 text-sm">This device can’t show the 3D room, so here is what’s inside it.</p>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {data.decor.map((d) => <li key={d.id} className="rounded-xl bg-night-2 p-2 text-xs">{d.image_path && /* eslint-disable-next-line @next/next/no-img-element */ <img src={roomImageUrl(d.image_path)!} alt={d.title ?? "Wall picture"} className="mb-1 aspect-square w-full rounded object-cover" />}{d.title ?? d.kind}</li>)}
        {data.items.map((i) => <li key={i.id} className="rounded-xl bg-night-2 p-3 text-sm">{byKind(i.kind)?.emoji} {byKind(i.kind)?.name}</li>)}
      </ul>
    </div>
  );
}
export type { Sel };

"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { movePin, pinPost, unpinPost } from "@/lib/actions/pins";

const btn = "min-h-10 rounded-xl px-3 text-sm font-extrabold disabled:opacity-40";

/** Owner-only buttons: pin a post, or move / unpin a pinned one. */
export function PinControls({ postId, pinned, index = 0, count = 0, canPin = true }: { postId: string; pinned: boolean; index?: number; count?: number; canPin?: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setErr(null); const r = await fn(); if (r.ok) router.refresh(); else setErr(r.error ?? "Try again."); });
  if (!pinned) {
    return (
      <div>
        <button type="button" disabled={pending || !canPin} onClick={() => go(() => pinPost(postId))} className={`${btn} w-full bg-night-3 text-chalk`} title={canPin ? undefined : "You can pin up to 3. Unpin one first."}>📌 Pin</button>
        {err && <p role="alert" className="mt-1 text-xs text-[#ffb4b4]">{err}</p>}
      </div>
    );
  }
  return (
    <div>
      <div className="flex gap-2">
        <button type="button" aria-label="Move earlier" disabled={pending || index === 0} onClick={() => go(() => movePin(postId, -1))} className={`${btn} bg-night-3`}>▲</button>
        <button type="button" aria-label="Move later" disabled={pending || index >= count - 1} onClick={() => go(() => movePin(postId, 1))} className={`${btn} bg-night-3`}>▼</button>
        <button type="button" disabled={pending} onClick={() => go(() => unpinPost(postId))} className={`${btn} ml-auto bg-night-3 text-chalk`}>Unpin</button>
      </div>
      {err && <p role="alert" className="mt-1 text-xs text-[#ffb4b4]">{err}</p>}
    </div>
  );
}

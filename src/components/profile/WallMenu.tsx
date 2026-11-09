"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice, Sheet } from "@/components/ui";
import { movePin, pinPost, unpinPost } from "@/lib/actions/pins";
import { deletePost } from "@/lib/actions/posts";

const item = "flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-bold hover:bg-night-3 disabled:opacity-40";

/** Three-dot menu at the top of a wall tile (owner only): pin or unpin, edit, delete. */
export function WallMenu({ postId, pinned = false, canPin = true, index = 0, count = 0 }: { postId: string; pinned?: boolean; canPin?: boolean; index?: number; count?: number }) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const go = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { setErr(null); const r = await fn(); if (r.ok) { setOpen(false); router.refresh(); } else setErr(r.error ?? "Try again."); });
  return (
    <div ref={box} className="absolute right-1.5 top-1.5 z-20">
      <button type="button" aria-label="Wall options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="grid h-9 w-9 place-items-center rounded-full bg-black/60 text-xl font-black leading-none text-white backdrop-blur">⋮</button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-48 overflow-hidden rounded-2xl border border-night-3 bg-night-2 py-1 shadow-xl">
          {pinned ? (
            <>
              <button role="menuitem" className={item} disabled={pending} onClick={() => go(() => unpinPost(postId))}>📌 Unpin</button>
              <button role="menuitem" className={item} disabled={pending || index === 0} onClick={() => go(() => movePin(postId, -1))}>▲ Move up</button>
              <button role="menuitem" className={item} disabled={pending || index >= count - 1} onClick={() => go(() => movePin(postId, 1))}>▼ Move down</button>
            </>
          ) : (
            <button role="menuitem" className={item} disabled={pending || !canPin} onClick={() => go(() => pinPost(postId))}>📌 {canPin ? "Pin to profile" : "Pins full (3)"}</button>
          )}
          <button role="menuitem" className={item} onClick={() => { setOpen(false); router.push(`/post/${postId}?edit=1`); }}>✎ Edit</button>
          <button role="menuitem" className={`${item} text-[#ff9a9a]`} onClick={() => { setOpen(false); setDel(true); }}>🗑 Delete</button>
          {err && <p role="alert" className="px-4 py-2 text-xs text-[#ffb4b4]">{err}</p>}
        </div>
      )}
      <Sheet open={del} onClose={() => setDel(false)} title="Delete this wall?">
        <p className="mb-4 text-chalk-dim">This removes the wall, its pictures, answers and replies for good.</p>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="mt-3 flex gap-2">
          <Button tone="danger" disabled={pending} onClick={() => start(async () => { const r = await deletePost(postId); if (r.ok) { setDel(false); router.refresh(); } else setErr(r.error); })}>Delete wall</Button>
          <Button tone="ghost" onClick={() => setDel(false)}>Keep it</Button>
        </div>
      </Sheet>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { BrickSwatch } from "@/components/private/BrickSwatch";
import { Notice, Sheet, inputCls } from "@/components/ui";
import { setBrick, setWallActive, uploadWallBackground } from "@/lib/actions/private";
import { BG_UPLOAD, BRICKS, BRICK_COLOURS, type BrickKey } from "@/lib/constants";
import type { ViewCard } from "@/lib/data/private";
import { cx } from "@/lib/utils";

type Tab = "brick" | "card" | "link";
const TABS: [Tab, string][] = [["brick", "Background"], ["card", "Add a wall"], ["link", "Link"]];

/** Everything an owner can change about their private wall, in one sheet. */
export function OwnerTools({ wallId, open, onClose, tab, setTab, brick, onBrick, cards, isActive }: {
  wallId: string;
  open: boolean; onClose: () => void; tab: Tab; setTab: (t: Tab) => void; brick: BrickKey; onBrick: (b: BrickKey) => void;
  cards: ViewCard[]; isActive: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [active, setActive] = useState(isActive);
  const file = useRef<HTMLInputElement>(null);
  const full = cards.filter((c) => c.kind === "post").length >= 18;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setErr(null);
    start(async () => { const r = await fn(); if (r.ok) { after?.(); router.refresh(); } else setErr(r.error ?? "Something went wrong."); });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Customize your wall">
      <div role="tablist" aria-label="What to change" className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-night p-1">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => { setTab(k); setErr(null); }}
            className={cx("rounded-lg px-1 py-2 text-[13px] font-bold", tab === k ? "bg-mustard text-[#2c1e02]" : "text-chalk-dim")}>{label}</button>
        ))}
      </div>
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}

      {tab === "brick" && (
        <div className="space-y-5">
          <p className="text-sm text-chalk-dim">What sits behind your cards, for you and everyone who visits.</p>
          {([["", "Brick colours"], ["-glow", "Glowing bricks"]] as const).map(([suffix, label]) => (
            <section key={label}>
              <h3 className="mb-2 text-sm font-bold">{label}</h3>
              <div className="grid grid-cols-3 gap-3">
                {BRICK_COLOURS.map((c) => {
                  const key = `bk-${c.key}${suffix}`;
                  return (
                    <button key={key} type="button" aria-pressed={brick === key} disabled={pending}
                      onClick={() => { onBrick(key); run(() => setBrick(wallId, key)); }}
                      className={cx("grid gap-1.5 rounded-xl border-2 p-2 text-xs font-bold", brick === key ? "border-mustard text-mustard" : "border-night-3 text-chalk")}>
                      <BrickSwatch k={key} className="h-16 rounded-lg" />{c.name}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {([["art", "Art"], ["life", "Lifestyle"]] as const).map(([g, label]) => (
            <section key={g}>
              <h3 className="mb-2 text-sm font-bold">{label}</h3>
              <div className="grid grid-cols-3 gap-3">
                {BRICKS.filter((b) => b.group === g).map((b) => (
                  <button key={b.key} type="button" aria-pressed={brick === b.key} disabled={pending}
                    onClick={() => { onBrick(b.key); run(() => setBrick(wallId, b.key)); }}
                    className={cx("grid gap-1.5 rounded-xl border-2 p-2 text-xs font-bold", brick === b.key ? "border-mustard text-mustard" : "border-night-3 text-chalk")}>
                    <span aria-hidden className="h-16 rounded-lg" style={{ background: `url(/wall/bg/${b.key}.jpg) center / cover`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }} />
                    {b.name}
                  </button>
                ))}
              </div>
            </section>
          ))}
          <section className="rounded-xl bg-night p-3">
            <h3 className="mb-1 text-sm font-bold">Use your own picture</h3>
            <p className="mb-3 text-xs text-chalk-dim">Upload a portrait picture, <b>{BG_UPLOAD.width} × {BG_UPLOAD.height} pixels</b> (9:16, the shape of a phone screen). JPG, PNG or WebP, up to {BG_UPLOAD.maxMb} MB. Other sizes are cropped to fit. Pick something calm in the middle so your cards stay easy to read.</p>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className={inputCls} aria-label="Choose a background picture" />
            <button type="button" disabled={pending} className="mt-3 w-full rounded-xl bg-mustard py-3 font-black text-[#2c1e02] disabled:opacity-50"
              onClick={() => {
                const f = file.current?.files?.[0];
                if (!f) { setErr("Choose a picture first."); return; }
                const fd = new FormData(); fd.set("image", f); fd.set("wall", wallId);
                run(() => uploadWallBackground(fd), () => { onBrick("custom"); if (file.current) file.current.value = ""; });
              }}>{pending ? "Uploading…" : brick === "custom" ? "Replace my picture" : "Upload and use it"}</button>
          </section>
        </div>
      )}

      {tab === "card" && (
        <div className="space-y-2">
          <p className="mb-1 text-sm text-chalk-dim">Pick a wall type. It is made for your private wall and hangs on it as soon as you post.</p>
          {([
            [`/create/ask-me?wall=${wallId}`, "Ask Me", "People ask you questions. You choose what to answer."],
            [`/create/hidden-thought?wall=${wallId}`, "Hidden Thought", "Share a thought with part of it concealed."],
            [`/create/picture-wall?wall=${wallId}`, "Picture Wall", "Pin a photo with a caption. It only shows on this wall."],
            [`/create/random-prompt?wall=${wallId}`, "Random Prompt", "Answer a conversation prompt."],
            [`/create/pick-number?wall=${wallId}`, "Pick a number", "A list of numbered questions. Tap the note to see them all."],
          ] as const).map(([href, l, d]) => (
            <Link key={href} href={href} className={cx("block rounded-xl bg-night p-3", full && "pointer-events-none opacity-50")}><span className="block font-bold">{l}</span><span className="block text-xs text-chalk-dim">{d}</span></Link>
          ))}
          {full && <p className="text-xs text-chalk-dim">Your wall is full (18 notes). Remove one to add another.</p>}
        </div>
      )}

      {tab === "link" && (
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-xl bg-night p-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#F9A719]" checked={active} disabled={pending} onChange={(e) => { setActive(e.target.checked); run(() => setWallActive(wallId, e.target.checked)); }} />
            <span><span className="block font-bold">Accepting visitors</span><span className="text-sm text-chalk-dim">Turn off to hide this wall. Nothing is deleted.</span></span>
          </label>
          <p className="text-sm text-chalk-dim">Visitors react and reply without an account. You can delete any reply on your own notes.</p>
        </div>
      )}
    </Sheet>
  );
}

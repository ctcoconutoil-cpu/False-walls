"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { IconPicker } from "@/components/create/IconPicker";
import { Notice, Sheet, inputCls } from "@/components/ui";
import { WallCard } from "@/components/wall/WallCard";
import { addPostCard, addPromptCard, setBrick, setWallActive, uploadWallBackground } from "@/lib/actions/private";
import { BG_UPLOAD, BRICKS, MAX_WALL_WORDS, WALL_COLORS, WALL_COLOR_CHOICES, clampWords, wordCount, type BrickKey } from "@/lib/constants";
import type { ViewCard } from "@/lib/data/private";
import type { WallPost } from "@/lib/data/wall";
import { cx } from "@/lib/utils";

type Tab = "brick" | "card" | "wall" | "link";
const TABS: [Tab, string][] = [["brick", "Brick"], ["card", "New card"], ["wall", "From the wall"], ["link", "Link"]];

/** Everything an owner can change about their private wall, in one sheet. */
export function OwnerTools({ open, onClose, tab, setTab, brick, onBrick, cards, candidates, isActive }: {
  open: boolean; onClose: () => void; tab: Tab; setTab: (t: Tab) => void; brick: BrickKey; onBrick: (b: BrickKey) => void;
  cards: ViewCard[]; candidates: WallPost[]; isActive: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState<string>("coral");
  const [active, setActive] = useState(isActive);
  const file = useRef<HTMLInputElement>(null);
  const pinned = new Set(cards.filter((c) => c.kind === "post").map((c) => c.post_id));
  const full = cards.length >= 18;
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => {
    setErr(null);
    start(async () => { const r = await fn(); if (r.ok) { after?.(); router.refresh(); } else setErr(r.error ?? "Something went wrong."); });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Customize your wall">
      <div role="tablist" aria-label="What to change" className="mb-4 grid grid-cols-4 gap-1 rounded-xl bg-night p-1">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => { setTab(k); setErr(null); }}
            className={cx("rounded-lg px-1 py-2 text-[13px] font-bold", tab === k ? "bg-mustard text-[#2c1e02]" : "text-chalk-dim")}>{label}</button>
        ))}
      </div>
      {err && <div className="mb-3"><Notice tone="error">{err}</Notice></div>}

      {tab === "brick" && (
        <div className="space-y-5">
          <p className="text-sm text-chalk-dim">What sits behind your cards, for you and everyone who visits.</p>
          {([["brick", "Brick colours"], ["art", "Art"], ["life", "Lifestyle"]] as const).map(([g, label]) => (
            <section key={g}>
              <h3 className="mb-2 text-sm font-bold">{label}</h3>
              <div className="grid grid-cols-3 gap-3">
                {BRICKS.filter((b) => b.group === g).map((b) => (
                  <button key={b.key} type="button" aria-pressed={brick === b.key} disabled={pending}
                    onClick={() => { onBrick(b.key); run(() => setBrick(b.key)); }}
                    className={cx("grid gap-1.5 rounded-xl border-2 p-2 text-xs font-bold", brick === b.key ? "border-mustard text-mustard" : "border-night-3 text-chalk")}>
                    <span aria-hidden className="h-20 rounded-lg" style={{ background: g === "brick" ? `url(/wall/bricks/${b.key}.webp) 0 0 / 120px 52px` : `url(/wall/bg/${b.key}.jpg) center / cover`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }} />
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
                const fd = new FormData(); fd.set("image", f);
                run(() => uploadWallBackground(fd), () => { onBrick("custom"); if (file.current) file.current.value = ""; });
              }}>{pending ? "Uploading…" : brick === "custom" ? "Replace my picture" : "Upload and use it"}</button>
          </section>
        </div>
      )}

      {tab === "card" && (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (!full) run(() => addPromptCard(title, icon, color), () => { setTitle(""); setIcon(""); onClose(); }); }}>
          <div className="space-y-2">
            <p className="text-sm font-bold">Full templates</p>
            {([["ask-me", "Ask Me", "People ask you questions. You choose what to answer."], ["hidden-thought", "Hidden Thought", "Share a thought with part of it concealed."], ["random-prompt", "Random Prompt", "Answer a conversation prompt."]] as const).map(([r, l, d]) => (
              <Link key={r} href={`/create/${r}?for=private`} className="block rounded-xl bg-night p-3"><span className="block font-bold">{l}</span><span className="block text-xs text-chalk-dim">{d}</span></Link>
            ))}
          </div>
          <p className="border-t border-night-3 pt-3 text-sm text-chalk-dim">Or add a quick card people can tap to send you a message. Keep it to one to three words.</p>
          <label className="block text-sm font-semibold">Card words ({wordCount(title)}/{MAX_WALL_WORDS})
            <input className={cx(inputCls, "mt-1.5")} value={title} maxLength={36} onChange={(e) => setTitle(clampWords(e.target.value))} placeholder="Roast Me" autoComplete="off" required />
          </label>
          <div className="flex flex-wrap gap-2">
            {["Roast Me", "Hot Take", "Spill It", "Ask Me Why", "Be Honest", "Dare Me", "Rate Me", "Judge Me", "Compliment Me", "Tell Me Off", "Guess Who", "Crush Alert", "Red Flag", "Hype Me", "Unpopular Opinion", "Secret Wish", "Advice Please", "Say Anything"].map((t) => (
              <button key={t} type="button" onClick={() => setTitle(t)} className="rounded-full border-2 border-night-3 px-3 py-1.5 text-xs font-bold text-chalk">{t}</button>
            ))}
          </div>
          <IconPicker value={icon} onChange={setIcon} />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Colour</legend>
            <div className="flex gap-2.5">
              {WALL_COLOR_CHOICES.map((c) => (
                <label key={c} className={cx("grid h-11 w-11 cursor-pointer place-items-center rounded-full border-[3px]", color === c ? "border-white" : "border-night-3")} style={{ background: WALL_COLORS[c].base }}>
                  <input type="radio" name="card_color" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only" />
                  <span className="sr-only">{WALL_COLORS[c].name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" disabled={pending || full || wordCount(title) < 1 || !icon} className="w-full rounded-xl bg-mustard py-3 font-black text-[#2c1e02] disabled:opacity-50">{full ? "Your wall is full (18 cards)" : pending ? "Adding…" : "Add to my wall"}</button>
        </form>
      )}

      {tab === "wall" && (
        <div>
          <p className="mb-3 text-sm text-chalk-dim">Hang a ready-made Ask Me, Hidden Thought or Random Prompt, or a post from the Main Wall. Visitors can open them.</p>
          {candidates.length === 0 ? <p className="text-sm text-chalk-dim">There is nothing to add yet.</p> : (
            <ul className="grid grid-cols-3 gap-x-3 gap-y-4">
              {candidates.map((p) => {
                const on = pinned.has(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" disabled={pending || on || full} aria-label={on ? `${p.title} is on your wall` : `Pin ${p.title} to your wall`}
                      onClick={() => run(() => addPostCard(p.id))} className="relative block w-full text-left disabled:opacity-60">
                      <span className="relative block" style={{ aspectRatio: "100 / 150" }}><WallCard post={p} p={{ variant: 0, seed: 0.2 }} /></span>
                      <span className={cx("mt-1.5 block rounded-full py-1 text-center text-[11px] font-black", on ? "bg-night-3 text-chalk-dim" : "bg-mustard text-[#2c1e02]")}>{on ? "On your wall" : "Add"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "link" && (
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-xl bg-night p-3">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#F9A719]" checked={active} disabled={pending} onChange={(e) => { setActive(e.target.checked); run(() => setWallActive(e.target.checked)); }} />
            <span><span className="block font-bold">Accepting visitors</span><span className="text-sm text-chalk-dim">Turn off to hide your wall and pause messages. Nothing is deleted.</span></span>
          </label>
          <p className="text-sm text-chalk-dim">Messages are anonymous. Only you can read them, and you can delete any of them.</p>
        </div>
      )}
    </Sheet>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui";

type Props = {
  open: boolean; onClose: () => void;
  path: string;        // the page to share, e.g. /w/abc123
  imagePath: string;   // the preview image route, e.g. /w/abc123/card
  title: string;       // short heading for the sheet
  text: string;        // the message that goes with the link
};

const btn = "flex min-h-12 items-center gap-3 rounded-xl bg-night-3 px-3 text-left font-bold active:bg-night";

/** Share a wall or a question: system share sheet, the main apps by link, copy link, and a story image to save. */
export function ShareSheet({ open, onClose, path, imagePath, title, text }: Props) {
  const [origin, setOrigin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [canNative, setCanNative] = useState(false);
  useEffect(() => { setOrigin(window.location.origin); setCanNative(typeof navigator.share === "function"); }, []);
  const url = origin + path;
  const enc = encodeURIComponent;
  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(null), 2400); };

  async function copy() {
    try { await navigator.clipboard.writeText(url); flash("Link copied."); }
    catch { window.prompt("Copy this link", url); }
  }
  async function nativeShare(withImage: boolean) {
    try {
      if (withImage) {
        const res = await fetch(`${imagePath}${imagePath.includes("?") ? "&" : "?"}format=story`);
        const file = new File([await res.blob()], "false-walls.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${text} ${url}` }); return; }
      }
      await navigator.share({ title, text, url });
    } catch (e) { if ((e as Error).name !== "AbortError") flash("Couldn't open the share menu. Copy the link instead."); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl bg-night px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate text-chalk-dim" aria-label="Share link">{url || path}</span>
          <button type="button" onClick={copy} className="min-h-9 shrink-0 rounded-lg bg-mustard px-3 font-bold text-[#2c1e02]">Copy link</button>
        </div>
        {canNative && (
          <div className="grid gap-2">
            <button type="button" onClick={() => nativeShare(true)} className={btn}><span aria-hidden className="text-xl">📲</span><span><span className="block">Share to Instagram, Snapchat, TikTok…</span><span className="block text-xs font-normal text-chalk-dim">Opens your phone's share menu with a story image</span></span></button>
            <button type="button" onClick={() => nativeShare(false)} className={btn}><span aria-hidden className="text-xl">🔗</span>Share link with any app</button>
          </div>
        )}
        <p className="pt-1 text-sm font-semibold text-chalk-dim">Share link to</p>
        <div className="grid grid-cols-2 gap-2">
          <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${enc(`${text} ${url}`)}`}><span aria-hidden className="text-xl">💬</span>WhatsApp</a>
          <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`}><span aria-hidden className="text-xl font-black">𝕏</span>X</a>
          <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`}><span aria-hidden className="text-xl">✈️</span>Telegram</a>
          <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}><span aria-hidden className="text-xl">👍</span>Facebook</a>
          <a className={btn} href={`mailto:?subject=${enc(title)}&body=${enc(`${text} ${url}`)}`}><span aria-hidden className="text-xl">✉️</span>Email</a>
          <a className={btn} href={`sms:?&body=${enc(`${text} ${url}`)}`}><span aria-hidden className="text-xl">📱</span>Text message</a>
        </div>
        <div className="rounded-xl bg-night p-3 text-sm text-chalk-dim">
          <p className="font-semibold text-chalk">Instagram, Snapchat and TikTok</p>
          <p className="mt-1">These apps don't let websites post for you. Save the story image, post it, and paste your link in a link sticker (Instagram, Snapchat) or your bio (TikTok).</p>
          <a href={`${imagePath}${imagePath.includes("?") ? "&" : "?"}format=story`} download="false-walls-story.png" className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-night-3 px-4 font-bold text-chalk">Save story image</a>
        </div>
        {msg && <p role="status" className="rounded-xl bg-teal/15 px-3 py-2 text-sm font-semibold text-[#9ff0e6]">{msg}</p>}
      </div>
    </Sheet>
  );
}

/** A button that opens the share sheet. */
export function ShareButton({ label = "Share", ...rest }: Omit<Props, "open" | "onClose"> & { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center gap-2 rounded-xl bg-night-3 px-4 font-bold text-chalk active:bg-night"><span aria-hidden>↗</span>{label}</button>
      <ShareSheet open={open} onClose={() => setOpen(false)} {...rest} />
    </>
  );
}

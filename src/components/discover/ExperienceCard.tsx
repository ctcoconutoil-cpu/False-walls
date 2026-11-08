"use client";
import { useEffect, useState, useTransition } from "react";
import { deleteExperience } from "@/lib/actions/discover";
import type { Experience } from "@/lib/data/discover";
import { EMOJI, TILES, VERB } from "@/components/discover/tiles";

/** Date and time in the viewer's own time zone. Rendered after mount so the server's zone never leaks in. */
function When({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => { setText(new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })); }, [iso]);
  return <time dateTime={iso}>{text ?? "…"}</time>;
}

/** One tile of the Experiences grid: coloured card, picture, title, short description and a white button out to the link. */
export function ExperienceCard({ e, mine, i }: { e: Experience; mine: boolean; i: number }) {
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;
  const t = TILES[i % TILES.length];
  const host = (() => { try { return new URL(e.url).hostname.replace(/^www\./, ""); } catch { return "link"; } })();
  return (
    <article className="flex h-full flex-col rounded-[22px] p-3.5" style={{ background: t.bg, color: t.ink }}>
      <div className="relative">
        {e.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.image} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-xl object-cover" />
        ) : <div className="aspect-[4/3] w-full rounded-xl bg-black/15" />}
        <span aria-hidden className="absolute -bottom-3 left-2 grid h-10 w-10 place-items-center rounded-full bg-black/55 text-xl backdrop-blur">{EMOJI[e.category] ?? "✨"}</span>
      </div>
      <h3 className="display mt-6 text-[21px] leading-tight">{e.title}</h3>
      {e.starts_at && <p className="mt-1 text-xs font-extrabold opacity-90">📅 <When iso={e.starts_at} /></p>}
      <p className="mt-1.5 line-clamp-3 text-[15px] leading-snug opacity-90">{e.description}</p>
      <div className="mt-auto pt-3">
        <a href={e.url} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={`${VERB[e.category] ?? "Open"}: ${e.title} on ${host}`}
          className="btn-press flex min-h-12 items-center rounded-xl bg-white px-4 text-[17px] font-extrabold" style={{ color: t.btn }}>
          {VERB[e.category] ?? "Open"} →
        </a>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs opacity-85">
          <span className="truncate">{e.author ? `by ${e.author.display_name || e.author.username}` : ""}</span>
          {mine && <button type="button" disabled={pending} className="font-bold underline" onClick={() => { if (confirm("Delete this experience?")) start(async () => { const r = await deleteExperience(e.id); if (r.ok) setGone(true); }); }}>Delete</button>}
        </div>
      </div>
    </article>
  );
}

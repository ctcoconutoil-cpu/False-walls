"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui";
import { deleteExperience } from "@/lib/actions/discover";
import { EXPERIENCE_CATEGORIES } from "@/lib/constants";
import type { Experience } from "@/lib/data/discover";

const TINT: Record<string, string> = { music: "#1879D2", games: "#F9A719", food: "#E51F2B", travel: "#1879D2", film: "#8B4CC4", sports: "#F9A719", art: "#E51F2B", learning: "#1879D2", wellness: "#8B4CC4", nightlife: "#8B4CC4", community: "#F9A719", other: "#D5B5A5" };

/** Date and time in the viewer's own time zone. Rendered after mount so the server's zone never leaks in. */
function When({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => { setText(new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })); }, [iso]);
  return <time dateTime={iso}>{text ?? "…"}</time>;
}

export function ExperienceCard({ e, mine }: { e: Experience; mine: boolean }) {
  const [gone, setGone] = useState(false);
  const [pending, start] = useTransition();
  if (gone) return null;
  const tint = TINT[e.category] ?? "#D5B5A5";
  const host = (() => { try { return new URL(e.url).hostname.replace(/^www\./, ""); } catch { return "link"; } })();
  return (
    <article className="overflow-hidden rounded-2xl bg-night-2 shadow-[0_5px_0_rgba(0,0,0,.35)]">
      <div className="relative aspect-[16/10] bg-night-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {e.image && <img src={e.image} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-extrabold text-white shadow" style={{ background: tint }}>{EXPERIENCE_CATEGORIES[e.category]}</span>
        {e.starts_at && <span className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white"><When iso={e.starts_at} /></span>}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="display text-xl leading-snug">{e.title}</h3>
        <p className="whitespace-pre-line text-sm text-chalk-dim">{e.description}</p>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-chalk-dim">
            {e.author && (<><Avatar user={e.author} size={20} /><Link href={`/profile/${e.author.username}`} className="truncate underline">{e.author.display_name || e.author.username}</Link></>)}
          </span>
          <a href={e.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="btn-press shrink-0 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white" style={{ background: tint, boxShadow: "0 3px 0 rgba(0,0,0,.4)" }} aria-label={`Open ${e.title} on ${host}`}>
            Open on {host} ↗
          </a>
        </div>
        {mine && (
          <button type="button" disabled={pending} className="text-xs font-bold text-chalk-dim underline" onClick={() => { if (confirm("Delete this experience?")) start(async () => { const r = await deleteExperience(e.id); if (r.ok) setGone(true); }); }}>Delete</button>
        )}
      </div>
    </article>
  );
}

import Link from "next/link";
import { EMOJI, TILES } from "@/components/discover/tiles";
import type { Experience } from "@/lib/data/discover";

/** A slim row under the Wall's header that showcases experiences. Tapping one opens the Experiences tab in Discover. */
export function ExperienceStrip({ items }: { items: Experience[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Experiences" className="wp-exp">
      <Link href="/discover?tab=experiences" className="wp-exp-label">Experiences ›</Link>
      <ul>
        {items.map((e, i) => {
          const t = TILES[i % TILES.length];
          return (
            <li key={e.id}>
              <Link href="/discover?tab=experiences" className="wp-exp-chip" style={{ background: t.bg, color: t.ink }}>
                <span aria-hidden>{EMOJI[e.category] ?? "✨"}</span><b>{e.title}</b>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

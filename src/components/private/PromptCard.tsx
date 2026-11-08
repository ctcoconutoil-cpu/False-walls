import { WallIcon, isWallIcon } from "@/components/wall/icons";
import { Flourish, TONE, compact, flourishFor, sizeFor } from "@/components/wall/WallCard";
import type { ViewCard } from "@/lib/data/private";

/** A prompt card on a private wall. The owner sees how many messages it holds; a visitor sees an invitation to tap. */
export function PromptCard({ card, mode, seed = 0.3 }: { card: ViewCard; mode: "owner" | "visitor"; seed?: number }) {
  const tone = TONE[card.color] ?? "red";
  const icon = isWallIcon(card.icon) ? card.icon : "star";
  const words = card.title ?? "";
  return (
    <span className={`wp-body wp-board wp-t-${tone}`} style={{ animationDelay: `${-seed * 6}s` }}>
      <span aria-hidden className="wp-bricktex" />
      <span className={`wp-icon ${icon === "ask" ? "wp-icon-disc" : ""}`}><WallIcon name={icon} size={icon === "ask" ? 30 : 34} /></span>
      <span className="wp-words" style={{ fontSize: sizeFor(words) }}>{words}</span>
      <Flourish kind={flourishFor(`${card.id}${words}`)} className="wp-flourish" />
      <span className="wp-foot">
        {mode === "owner" ? (
          <span className="pw-count">
            <b>{compact(card.total ?? 0)}</b>
            {(card.unread ?? 0) > 0 && <em>+{compact(card.unread ?? 0)} new</em>}
          </span>
        ) : <span className="pw-tap">Tap to send</span>}
      </span>
      <i aria-hidden className="wp-sheen" />
    </span>
  );
}

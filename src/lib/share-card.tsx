import { ImageResponse } from "next/og";
import { WALL_COLORS } from "@/lib/constants";
import type { WallColor } from "@/lib/types";

export type CardData = {
  kind: "wall" | "question";
  title: string;            // wall title or the question
  subtitle?: string | null; // wall subtitle, or the answer for a question card
  count?: number;           // how many numbers a Pick a number wall has
  color?: string;
  by?: string | null;       // who it belongs to
};
export type CardFormat = "og" | "story";

// The image font has no emoji or symbol glyphs, so those are removed rather than drawn as empty boxes.
const clean = (s: string) => s.replace(/[\p{Extended_Pictographic}‍️]/gu, "").replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export function shareCard(d: CardData, format: CardFormat) {
  const story = format === "story";
  const W = story ? 1080 : 1200, H = story ? 1920 : 630;
  const c = WALL_COLORS[(d.color as WallColor) in WALL_COLORS ? (d.color as WallColor) : "coral"];
  const title = clip(clean(d.title), story ? 140 : 110);
  const sub = d.subtitle ? clip(clean(d.subtitle), story ? 220 : 130) : null;
  const tag = d.kind === "question" ? "ANONYMOUS QUESTION" : d.count ? "PICK A NUMBER" : "PRIVATE WALL";
  const titleSize = story ? (title.length > 70 ? 76 : 96) : title.length > 60 ? 46 : 60;
  const badge = story ? 360 : 240;
  const chips = d.count ? Array.from({ length: Math.min(d.count, 10) }, (_, i) => i + 1) : [];

  const brick = (
    <div style={{ display: "flex", width: badge, height: badge, borderRadius: badge, background: "#14112a", border: `${story ? 14 : 10}px solid ${c.base}`, alignItems: "center", justifyContent: "center", color: c.base, fontSize: badge * 0.55, fontWeight: 900 }}>
      {d.kind === "question" ? "?" : d.count ? "#" : "?"}
    </div>
  );

  const text = (
    <div style={{ display: "flex", flexDirection: "column", gap: story ? 36 : 18, alignItems: story ? "center" : "flex-start", textAlign: story ? "center" : "left", maxWidth: story ? 900 : 620 }}>
      <div style={{ display: "flex", background: c.base, color: c.ink, fontSize: story ? 38 : 22, fontWeight: 800, letterSpacing: 3, padding: story ? "14px 30px" : "8px 18px", borderRadius: 999 }}>{tag}</div>
      <div style={{ display: "flex", fontSize: titleSize, fontWeight: 900, lineHeight: 1.08, color: "#f6f3ea", textTransform: d.kind === "question" ? "none" : "uppercase" }}>{d.kind === "question" ? `“${title}”` : title}</div>
      {sub && <div style={{ display: "flex", fontSize: story ? 44 : 28, color: d.kind === "question" ? c.base : "#b9b3d6", lineHeight: 1.25 }}>{d.kind === "question" ? `Answer: ${sub}` : sub}</div>}
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: story ? 16 : 10, justifyContent: story ? "center" : "flex-start", maxWidth: story ? 820 : 560 }}>
          {chips.map((n) => (
            <div key={n} style={{ display: "flex", width: story ? 96 : 56, height: story ? 96 : 56, borderRadius: story ? 24 : 14, background: "#ece7de", color: "#1b1730", fontSize: story ? 52 : 30, fontWeight: 900, alignItems: "center", justifyContent: "center" }}>{n}</div>
          ))}
        </div>
      )}
    </div>
  );

  const footer = (
    <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#b9b3d6", fontSize: story ? 40 : 24, fontWeight: 700 }}>
      <div style={{ display: "flex", color: "#f6f3ea", fontWeight: 900, letterSpacing: 2 }}>FALSE WALLS</div>
      <div style={{ display: "flex" }}>{d.by ? `· ${clip(clean(d.by), 28)}` : "· Look closer. There's more behind the wall."}</div>
    </div>
  );

  return new ImageResponse(
    story ? (
      <div style={{ display: "flex", flexDirection: "column", width: W, height: H, background: "linear-gradient(160deg,#1d1840 0%,#14112a 55%,#0c0919 100%)", alignItems: "center", justifyContent: "space-between", padding: "140px 70px 120px" }}>
        {brick}{text}{footer}
      </div>
    ) : (
      <div style={{ display: "flex", width: W, height: H, background: "linear-gradient(135deg,#1d1840 0%,#14112a 60%,#0c0919 100%)", alignItems: "center", justifyContent: "space-between", padding: "50px 70px", flexDirection: "column" }}>
        <div style={{ display: "flex", flex: 1, width: "100%", alignItems: "center", justifyContent: "space-between", gap: 50 }}>{brick}{text}</div>
        {footer}
      </div>
    ),
    { width: W, height: H, headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}

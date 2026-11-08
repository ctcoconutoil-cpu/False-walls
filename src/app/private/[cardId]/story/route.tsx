import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { WallIcon, isWallIcon } from "@/components/wall/icons";
import { WALL_COLORS } from "@/lib/constants";
import { getAuthUser } from "@/lib/supabase/claims";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import type { WallColor } from "@/lib/types";

// What each card colour uses for its icon, and for the pill at the bottom.
const ACCENT: Record<WallColor, string> = { coral: "#F9A719", mustard: "#2A1A05", teal: "#F9A719", sky: "#F9A719", violet: "#C7A0EC", lime: "#2A1A05", rose: "#E51F2B", slate: "#F9A719" };
const PILL: Record<WallColor, { bg: string; ink: string }> = {
  coral: { bg: "#E51F2B", ink: "#FFFFFF" }, mustard: { bg: "#F9A719", ink: "#2A1A05" }, teal: { bg: "#1879D2", ink: "#FFFFFF" }, sky: { bg: "#1879D2", ink: "#FFFFFF" },
  violet: { bg: "#8B4CC4", ink: "#FFFFFF" }, lime: { bg: "#F9A719", ink: "#2A1A05" }, rose: { bg: "#D5B5A5", ink: "#3A1D14" }, slate: { bg: "#F6EFE4", ink: "#29252A" },
};
const BRICK_PNG = new Set(["classic", "charcoal", "navy", "plum", "forest", "sand"]);
const clean = (s: string) => s.replace(/[\p{Extended_Pictographic}‍️]/gu, "").replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

/**
 * A 1080x1920 story image of one anonymous message: the card it was sent to, the note stuck on the brick, and the
 * owner's link. Only the owner can make it, and only for a message sent to them.
 */
export async function GET(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const m = new URL(req.url).searchParams.get("m") ?? "";
  if (!isUuid(cardId) || !isUuid(m)) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return new Response("Log in first", { status: 401 });
  const [{ data: sub }, { data: card }] = await Promise.all([
    supabase.from("submissions").select("body").eq("id", m).eq("card_id", cardId).maybeSingle(),
    supabase.from("wall_cards").select("title, icon, color, owner_id").eq("id", cardId).eq("kind", "prompt").maybeSingle(),
  ]);
  if (!sub || !card) return new Response("Not found", { status: 404 });
  const { data: wall } = await supabase.from("private_walls").select("slug, brick").eq("owner_id", card.owner_id).maybeSingle();
  if (!wall) return new Response("Not found", { status: 404 });

  const origin = new URL(req.url).origin;
  const pic = ["art1", "art2", "life1", "life2"].includes(wall.brick as string);
  const pub = (f: string) => readFile(path.join(process.cwd(), "public", f));
  const [fontBuf, brickBuf] = await Promise.all([pub("fonts/caveat-brush.woff"), pic ? pub(`wall/bg/${wall.brick}.jpg`) : pub(`wall/bricks/${BRICK_PNG.has(wall.brick as string) ? wall.brick : "classic"}.png`)]);
  const font = fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength) as ArrayBuffer;
  const brick = `data:image/${pic ? "jpeg" : "png"};base64,${brickBuf.toString("base64")}`;
  const color = (card.color as WallColor) in WALL_COLORS ? (card.color as WallColor) : "coral";
  const c = WALL_COLORS[color], pill = PILL[color];
  const icon = isWallIcon(card.icon as string) ? (card.icon as string) : "star";
  const body = clip(clean(sub.body as string), 260);
  const bodySize = body.length <= 50 ? 112 : body.length <= 110 ? 88 : body.length <= 180 ? 70 : 58;
  const title = clip(clean(card.title as string), 30);
  const host = origin.replace(/^https?:\/\//, "");

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 1080, height: 1920, position: "relative", fontFamily: "Brush", backgroundColor: "#2a110c", backgroundImage: `url(${brick})`, backgroundSize: pic ? "1080px 1920px" : "768px 336px" }}>
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: 1080, height: 1920, backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 28%, rgba(0,0,0,0.05) 66%, rgba(0,0,0,0.7) 100%)" }} />
        <div style={{ display: "flex", marginTop: 90, fontSize: 70, color: "#FFFFFF", letterSpacing: 6, textShadow: "0 4px 0 rgba(0,0,0,0.5)" }}>FALSE WALLS</div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: 70, width: 540, height: 660, borderRadius: 14, backgroundImage: `linear-gradient(160deg, ${c.base}, ${c.dark})`, boxShadow: "0 36px 60px rgba(0,0,0,0.6), inset 0 0 0 10px rgba(255,255,255,0.14), 6px 8px 0 rgba(0,0,0,0.4)", transform: "rotate(-3deg)" }}>
          <WallIcon name={icon} size={210} color={ACCENT[color]} />
          <div style={{ display: "flex", marginTop: 40, padding: "0 30px", textAlign: "center", fontSize: title.length > 14 ? 96 : 128, lineHeight: 1, color: c.ink, justifyContent: "center" }}>{title}</div>
          <svg width="330" height="46" viewBox="0 0 84 26" style={{ marginTop: 26 }}><path d="M4 16C24 6 56 6 76 16" fill="none" stroke={c.ink} strokeWidth="4" strokeLinecap="round" /></svg>
        </div>

        <div style={{ display: "flex", position: "relative", marginTop: -30, width: 900, padding: "84px 64px 96px", backgroundColor: "#F6EFE2", boxShadow: "0 30px 50px rgba(0,0,0,0.55)", transform: "rotate(2deg)", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", position: "absolute", top: -26, left: 150, width: 190, height: 56, backgroundColor: "rgba(240,230,190,0.9)", transform: "rotate(-5deg)" }} />
          <div style={{ display: "flex", position: "absolute", top: -26, right: 150, width: 190, height: 56, backgroundColor: "rgba(240,230,190,0.9)", transform: "rotate(4deg)" }} />
          <div style={{ display: "flex", textAlign: "center", fontSize: bodySize, lineHeight: 1.08, color: "#2A1A05", justifyContent: "center" }}>{body}</div>
          <div style={{ display: "flex", position: "absolute", bottom: 26, fontSize: 38, color: "#7a6850", letterSpacing: 4 }}>ANONYMOUS MESSAGE</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", bottom: 110 }}>
          <div style={{ display: "flex", padding: "18px 56px", borderRadius: 999, backgroundColor: pill.bg, color: pill.ink, fontSize: 70, boxShadow: "0 8px 0 rgba(0,0,0,0.4)" }}>Send me anonymous messages</div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 56, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.6)" }}>{`${host}/u/${wall.slug}`}</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1920, fonts: [{ name: "Brush", data: font, weight: 400, style: "normal" }], headers: { "Cache-Control": "private, no-store" } },
  );
}

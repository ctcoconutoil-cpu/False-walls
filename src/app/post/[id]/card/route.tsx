import { getPostById } from "@/lib/data/posts";
import { shareCard } from "@/lib/share-card";
import { isUuid } from "@/lib/utils";

// Link-preview image for a public wall. Concealed content never appears: only the clue does.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const p = await getPostById(id);
  if (!p || p.visibility !== "public" || p.status !== "active") return new Response("Not found", { status: 404 });
  const concealed = p.type === "false_wall" || p.type === "hidden_thought";
  const title = concealed ? p.clue ?? "There's something behind this wall" : p.title ?? p.body ?? "A wall";
  const format = new URL(req.url).searchParams.get("format") === "story" ? "story" : "og";
  const tag = p.type === "false_wall" ? "FALSE WALL" : p.type === "picture" ? "PICTURE WALL" : p.type === "ask_me" ? "ASK ME" : p.type === "hidden_thought" ? "HIDDEN THOUGHT" : "FALSE WALL";
  return shareCard({ kind: "wall", tag, title, subtitle: concealed ? "Tap to look closer" : null, color: p.wall_color, by: p.author ? `@${p.author.username}` : null }, format);
}

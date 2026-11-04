import { getSharedWall } from "@/lib/data/shared";
import { shareCard } from "@/lib/share-card";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const w = await getSharedWall(token);
  if (!w) return new Response("Not found", { status: 404 });
  const format = new URL(req.url).searchParams.get("format") === "story" ? "story" : "og";
  return shareCard({ kind: "wall", title: w.title, subtitle: w.body, count: w.template === "pick_number" ? w.options?.length ?? 0 : undefined, color: w.wall_color, by: `@${w.author.username}` }, format);
}

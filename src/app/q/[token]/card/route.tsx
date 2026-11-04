import { getSharedQuestion } from "@/lib/data/shared";
import { shareCard } from "@/lib/share-card";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = await getSharedQuestion(token);
  if (!q) return new Response("Not found", { status: 404 });
  const format = new URL(req.url).searchParams.get("format") === "story" ? "story" : "og";
  return shareCard({ kind: "question", title: q.question, subtitle: q.answer, color: "violet", by: `Ask @${q.author.username}` }, format);
}

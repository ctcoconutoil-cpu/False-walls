import type { Metadata } from "next";
import { getPostById } from "@/lib/data/posts";
import { PostView } from "@/components/wall/PostView";
import { isUuid } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Behind the Wall" };
  const p = await getPostById(id);
  // Concealed content never appears in page titles.
  const t = p && p.type !== "false_wall" && p.type !== "hidden_thought" ? p.title ?? p.body?.slice(0, 60) : null;
  const title = t ? `${t}` : "Behind the Wall";
  if (!p || p.visibility !== "public" || p.is_sample) return { title, robots: { index: false, follow: false } };
  // Public walls get a link-preview image. Concealed content never appears in it, only the clue.
  const description = p.type === "false_wall" || p.type === "hidden_thought" ? "There's something behind this wall. Look closer." : (p.body ?? "Open the wall and join the conversation.").slice(0, 160);
  const image = `/post/${id}/card`;
  return {
    title, description,
    openGraph: { title, description, type: "article", siteName: "FALSE WALLS", images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function BehindTheWall({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostView id={id} />;
}

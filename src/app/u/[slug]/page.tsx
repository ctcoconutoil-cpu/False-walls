import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrivateWallView } from "@/components/private/PrivateWallView";
import { getPublicPrivateWall } from "@/lib/data/private";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const w = await getPublicPrivateWall(slug);
  if (!w) return { title: "Wall not found" };
  const name = w.owner.display_name || w.owner.username;
  return { title: `${name}'s wall`, description: `Open the notes on ${name}'s wall No sign-up needed.`, robots: { index: false } };
}

/** The public page behind someone's bio link. Anyone can open it; nothing here needs an account. */
export default async function VisitorWall({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await getPublicPrivateWall(slug);
  if (!w) notFound();
  return <div data-nopad=""><PrivateWallView mode="visitor" slug={w.slug} brick={w.brick} bg={w.bg} cards={w.cards} owner={w.owner} /></div>;
}

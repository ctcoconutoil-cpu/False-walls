import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PrivateWallView } from "@/components/private/PrivateWallView";
import { getPublicPrivateWall } from "@/lib/data/private";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const w = await getPublicPrivateWall(slug);
  if (!w) return { title: "Wall not found" };
  const name = w.owner.display_name || w.owner.username;
  return { title: `Send ${name} an anonymous message`, description: `Tap a card on ${name}'s wall and say anything. No sign-up, and they will never know it was you.`, robots: { index: false } };
}

/** The public page behind someone's bio link. Anyone can open it; nothing here needs an account. */
export default async function VisitorWall({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await getPublicPrivateWall(slug);
  if (!w) notFound();
  const alreadySent = !!(await cookies()).get(`fw_sent_${w.slug.toLowerCase()}`);
  return <div data-nopad=""><PrivateWallView alreadySent={alreadySent} mode="visitor" slug={w.slug} brick={w.brick} bg={w.bg} cards={w.cards} owner={w.owner} accepting={w.accepting} /></div>;
}

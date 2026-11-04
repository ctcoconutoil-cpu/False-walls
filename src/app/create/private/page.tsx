import Link from "next/link";
import { requireMember } from "@/lib/data/session";
import { PrivateWallForm } from "@/components/create/PrivateWallForm";

export const metadata = { title: "Private link wall" };

export default async function PrivateWallPage() {
  const { settings } = await requireMember("/create/private");
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/create" className="text-sm text-chalk-dim underline">‹ All wall types</Link>
      <h1 className="mt-1 text-3xl">Private link wall</h1>
      <p className="mb-6 mt-1 text-chalk-dim">Share it on Instagram, Snapchat, TikTok, X or WhatsApp and get questions in your inbox.</p>
      <PrivateWallForm anonymousAllowed={!!settings.allow_anonymous_questions} />
    </main>
  );
}

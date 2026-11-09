import { BackLink } from "@/components/wall/BackLink";
import { notFound } from "next/navigation";
import { GistCard } from "@/components/discover/GistFeed";
import { getGist } from "@/lib/data/discover";
import { requireMember } from "@/lib/data/session";
import { isUuid } from "@/lib/utils";

export const metadata = { title: "Walls Gist", robots: { index: false } };
export const dynamic = "force-dynamic";

/** One Walls Gist post, opened from a shared link, with its comments already showing. */
export default async function GistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requireMember(`/gist/${id}`);
  const g = await getGist(id);
  if (!g) notFound();
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 pb-[calc(var(--dock)+1.5rem)] pt-4">
      <BackLink fallback="/discover?tab=gist" className="inline-flex min-h-11 items-center text-sm font-bold underline">‹ Back</BackLink>
      <ul><GistCard g={g} startOpen /></ul>
    </main>
  );
}

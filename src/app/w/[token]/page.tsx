import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedWall } from "@/lib/data/shared";
import { getViewer } from "@/lib/data/session";
import { SharedAsk } from "@/components/share/SharedAsk";
import { ShareButton } from "@/components/share/ShareSheet";
import { Avatar } from "@/components/ui";
import { WALL_COLORS } from "@/lib/constants";

type P = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { token } = await params;
  const w = await getSharedWall(token);
  if (!w) return { title: "Wall not found", robots: { index: false } };
  const title = w.template === "pick_number" ? `${w.title}` : w.title;
  const description = w.body || (w.template === "pick_number" ? "Pick a number and send it. You can stay anonymous." : "Send me a question. You can stay anonymous.");
  const image = `/w/${token}/card`;
  return {
    title, description, robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "FALSE WALLS", images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharedWallPage({ params }: P) {
  const { token } = await params;
  const [w, viewer] = await Promise.all([getSharedWall(token), getViewer()]);
  if (!w) notFound();
  const c = WALL_COLORS[w.wall_color] ?? WALL_COLORS.coral;
  const owner = viewer.profile?.username === w.author.username;
  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-6 px-4 py-8" data-nopad>
      <div className="relative mx-auto w-full max-w-xs">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/wall/brick.png" alt="" width={380} height={256} className="w-full drop-shadow-[0_8px_10px_rgba(0,0,0,.5)]" />
        <span aria-hidden className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 bg-night text-4xl" style={{ borderColor: c.base }}>{w.wall_icon || (w.template ? "#" : "?")}</span>
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-3xl uppercase leading-tight sm:text-4xl">{w.title}</h1>
        {w.body && <p className="text-lg text-chalk-dim">{w.body}</p>}
        <Link href={`/profile/${w.author.username}`} className="inline-flex items-center gap-2 text-sm font-bold text-chalk-dim"><Avatar user={w.author as never} size={24} />by {w.author.display_name || w.author.username}</Link>
      </div>
      {owner ? (
        <div className="space-y-3 rounded-2xl bg-night-2 p-4 text-center">
          <p className="font-semibold">This is your private wall. Only people with this link can see it.</p>
          <ShareButton path={`/w/${token}`} imagePath={`/w/${token}/card`} title="Share your wall" text={`${w.title} — send me an anonymous message`} />
        </div>
      ) : (
        <SharedAsk token={token} template={w.template} options={w.options ?? []} allowAnonymous={w.allow_anonymous} loggedIn={!!viewer.profile} accent={c.base} ink={c.ink} />
      )}
      <p className="text-center text-xs text-chalk-dim">Be kind. Messages that break the <Link href="/guidelines" className="underline">community guidelines</Link> can be reported and removed. <Link href="/" className="underline">What is FALSE WALLS?</Link></p>
    </main>
  );
}

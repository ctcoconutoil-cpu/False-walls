import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedQuestion } from "@/lib/data/shared";
import { ShareButton } from "@/components/share/ShareSheet";

type P = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { token } = await params;
  const q = await getSharedQuestion(token);
  if (!q) return { title: "Question not found", robots: { index: false } };
  const title = `Anonymous question for ${q.author.display_name || q.author.username}`;
  const description = q.question.slice(0, 160);
  const image = `/q/${token}/card`;
  return {
    title, description, robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "FALSE WALLS", images: [{ url: image, width: 1200, height: 630, alt: description }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function SharedQuestionPage({ params }: P) {
  const { token } = await params;
  const q = await getSharedQuestion(token);
  if (!q) notFound();
  const name = q.author.display_name || q.author.username;
  const ask = q.wall_token ? `/w/${q.wall_token}` : `/profile/${q.author.username}`;
  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-6 px-4 py-10" data-nopad>
      <p className="text-center text-sm font-bold uppercase tracking-widest text-chalk-dim">Anonymous question for {name}</p>
      <blockquote className="display rounded-3xl bg-[#1d1a3a] p-6 text-3xl leading-snug">“{q.question}”</blockquote>
      {q.answer && <div className="rounded-3xl bg-night-2 p-5"><p className="text-xs font-bold uppercase tracking-widest text-mustard">{name} answered</p><p className="mt-2 whitespace-pre-wrap text-lg">{q.answer}</p></div>}
      <Link href={ask} className="btn-press block rounded-2xl bg-coral p-4 text-center text-lg font-black text-[#2a0d08]">Send {name} your own question</Link>
      <div className="flex justify-center"><ShareButton path={`/q/${token}`} imagePath={`/q/${token}/card`} title="Share this question" text={`Anonymous question for ${name}`} /></div>
      <p className="text-center text-xs text-chalk-dim"><Link href="/" className="underline">What is FALSE WALLS?</Link></p>
    </main>
  );
}

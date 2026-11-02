import Link from "next/link";
export function Prose({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 pb-[calc(var(--dock)+2rem)] pt-8">
      <Link href="/" className="text-sm underline">Home</Link>
      <h1 className="mt-4 text-4xl">{title}</h1>
      <p className="mt-1 text-sm text-chalk-dim">Last updated {updated}</p>
      <div className="mt-6 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_a]:underline">{children}</div>
    </main>
  );
}

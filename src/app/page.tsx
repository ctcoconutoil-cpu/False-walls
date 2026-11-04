import { redirect } from "next/navigation";
import { LinkButton, Wordmark } from "@/components/ui";
import { HeroWall } from "@/components/home/HeroWall";
import { getViewer } from "@/lib/data/session";
import { TAGLINE } from "@/lib/constants";

export default async function Welcome() {
  const { user, profile } = await getViewer();
  if (user && profile) redirect("/wall");
  return (
    <main data-nopad className="wall wall-brick relative min-h-dvh overflow-hidden" style={{ ["--wall" as string]: "#2a2450", ["--mortar" as string]: "#1d1a3a" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(242,87,63,.28),transparent_60%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-between gap-8 px-5 py-10">
        <header className="space-y-5">
          <Wordmark size="lg" />
          <p className="display text-2xl text-mustard">{TAGLINE}</p>
        </header>
        <HeroWall />
        <section className="space-y-4">
          <p className="text-lg text-chalk">Explore walls, uncover conversations and discover what people have to say.</p>
          <div className="grid gap-3">
            <LinkButton href="/wall" tone="mustard" size="lg">Enter the Wall</LinkButton>
            <div className="grid grid-cols-2 gap-3">
              <LinkButton href="/signup" tone="coral">Create Account</LinkButton>
              <LinkButton href="/login" tone="ghost">Log In</LinkButton>
            </div>
          </div>
          <p className="text-xs text-chalk-dim">For people aged 17 and over. <a className="underline" href="/guidelines">Community guidelines</a> · <a className="underline" href="/privacy">Privacy and anonymity</a></p>
        </section>
      </div>
    </main>
  );
}

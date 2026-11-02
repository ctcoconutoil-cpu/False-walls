import { redirect } from "next/navigation";
import { getViewer } from "@/lib/data/session";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui";

export const metadata = { title: "Account suspended" };
export default async function Suspended() {
  const { profile } = await getViewer();
  if (!profile) redirect("/");
  if (profile.status !== "suspended") redirect("/maze");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-5">
      <h1 className="text-3xl">Your account is suspended</h1>
      <p className="text-chalk-dim">Your account broke the community guidelines, so you can't post, ask or answer right now. Your walls are hidden while this is in place.</p>
      <form action={signOut}><Button type="submit" tone="ghost">Log out</Button></form>
    </main>
  );
}

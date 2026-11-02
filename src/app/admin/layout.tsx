import Link from "next/link";
import { requireStaff } from "@/lib/data/session";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

// Server-side gate: non-staff get a 404, whatever the client shows.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  const isAdmin = profile.role === "admin";
  const tabs = [["/admin", "Overview"], ["/admin/reports", "Reports"], ["/admin/content", "Content"], ["/admin/users", "Users"], ...(isAdmin ? [["/admin/prompts", "Prompts"], ["/admin/badges", "Badges"]] : []), ["/admin/log", "Log"]];
  return (
    <div className="min-h-dvh bg-night">
      <header className="border-b-4 border-mustard bg-night-2 px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <p className="display text-xl">Moderation <span className="text-sm font-normal text-chalk-dim">({profile.role})</span></p>
          <Link href="/maze" className="text-sm underline">Back to the maze</Link>
        </div>
        <nav aria-label="Admin sections" className="scrollbar-none mx-auto mt-2 flex max-w-4xl gap-2 overflow-x-auto">
          {tabs.map(([h, l]) => <Link key={h} href={h} className="shrink-0 rounded-full bg-night-3 px-3.5 py-2 text-sm font-bold">{l}</Link>)}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}

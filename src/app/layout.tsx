import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
import { Dock } from "@/components/Dock";
import { getViewer } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { default: "FALSE WALLS", template: "%s · FALSE WALLS" },
  description: "Explore walls, uncover conversations and discover what people have to say.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#14112a" };

async function unreadCount(userId: string) {
  const supabase = await createClient();
  const [n, q] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("recipient_id", userId).eq("status", "pending"),
  ]);
  return (n.count ?? 0) + (q.count ?? 0);
}

// The unread badge streams in on its own so it never holds up the page.
async function DockWithUnread({ username, userId }: { username: string | null; userId: string | null }) {
  const unread = userId ? await unreadCount(userId) : 0;
  return <Dock username={username} unread={unread} />;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile, user } = await getViewer();
  const username = profile?.username ?? null;
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("fw-motion")==="reduced")document.documentElement.dataset.motion="reduced"}catch(e){}` }} /></head>
      <body className="min-h-full">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-mustard focus:px-3 focus:py-2 focus:text-[#2c1e02]">Skip to content</a>
        <div id="main" style={{ paddingBottom: "var(--dock, 68px)" }} className="min-h-dvh [&:has(>[data-nopad])]:pb-0">{children}</div>
        <Suspense fallback={<Dock username={username} unread={0} />}><DockWithUnread username={username} userId={user && profile ? user.id : null} /></Suspense>
      </body>
    </html>
  );
}

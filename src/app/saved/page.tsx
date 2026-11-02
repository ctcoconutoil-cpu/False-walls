import Link from "next/link";
import { requireMember } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { getPostsByIds } from "@/lib/data/posts";
import { Empty } from "@/components/ui";
import { WallItem } from "@/components/maze/WallItem";

export const metadata = { title: "Saved walls" };
export default async function Saved() {
  const { user } = await requireMember("/saved");
  const supabase = await createClient();
  const { data } = await supabase.from("saved_posts").select("post_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(60);
  const posts = await getPostsByIds((data ?? []).map((d) => d.post_id as string));
  const order = new Map((data ?? []).map((d, i) => [d.post_id as string, i]));
  posts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-3xl">Saved walls</h1>
      {posts.length === 0 ? <Empty title="Nothing saved yet" action={<Link href="/maze" className="font-bold text-mustard underline">Explore the maze</Link>}>Use Save on any wall to keep it here. Walls that are removed or hidden won't appear.</Empty> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{posts.map((p) => <li key={p.id} className="h-40"><Link href={`/post/${p.id}`} className="block h-full"><WallItem post={p} compact /></Link></li>)}</ul>
      )}
    </main>
  );
}

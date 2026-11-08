"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui";
import { setFollow } from "@/lib/actions/social";
import type { Person } from "@/lib/data/discover";

/** People you might like. Following someone refreshes the page so their gist can appear. */
export function People({ people }: { people: Person[] }) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  if (people.length === 0) return null;
  return (
    <section aria-label="People you might like" className="space-y-2">
      <h2 className="display text-xl">People you might like</h2>
      <ul className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {people.map((p) => (
          <li key={p.id} className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-2xl bg-night-2 p-3 text-center">
            <Link href={`/profile/${p.username}`} className="flex flex-col items-center gap-1.5"><Avatar user={p} size={64} /><span className="w-full truncate text-sm font-bold">{p.display_name || p.username}</span></Link>
            <button type="button" disabled={pending || done.has(p.id)} className="w-full rounded-full bg-mustard px-3 py-2 text-sm font-extrabold text-[#2c1e02] disabled:opacity-60"
              onClick={() => start(async () => { const r = await setFollow(p.id, true); if (r.ok) { setDone(new Set(done).add(p.id)); router.refresh(); } })}>
              {done.has(p.id) ? "Following" : "Follow"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

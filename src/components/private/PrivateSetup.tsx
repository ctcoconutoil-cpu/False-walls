"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Notice } from "@/components/ui";
import { createPrivateWall } from "@/lib/actions/private";
import { BRICKS, type BrickKey } from "@/lib/constants";
import { cx } from "@/lib/utils";

/** First visit to /private: pick a brick and the wall is created with three starter cards. */
export function PrivateSetup({ username }: { username: string }) {
  const router = useRouter();
  const [brick, setBrick] = useState<BrickKey>("classic");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <main className="mx-auto max-w-md px-4 py-8" data-nopad="">
      <h1 className="text-3xl">Your private wall</h1>
      <p className="mt-2 text-chalk-dim">A brick wall of your own. Share one link, and anyone can tap a card and send you an anonymous message. Only you can read them.</p>
      <p className="mt-3 rounded-xl bg-night-2 px-3 py-2 text-sm">Your link will be <b className="break-all text-mustard">/u/{username.toLowerCase()}</b></p>
      <h2 className="mb-3 mt-6 text-lg">Pick your brick</h2>
      <div className="grid grid-cols-3 gap-3">
        {BRICKS.map((b) => (
          <button key={b.key} type="button" aria-pressed={brick === b.key} onClick={() => setBrick(b.key)}
            className={cx("grid gap-1.5 rounded-xl border-2 p-2 text-xs font-bold", brick === b.key ? "border-mustard text-mustard" : "border-night-3 text-chalk")}>
            <span aria-hidden className="h-16 rounded-lg" style={{ background: `url(/wall/bricks/${b.key}.webp) 0 0 / 120px 52px`, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2)" }} />{b.name}
          </button>
        ))}
      </div>
      {err && <div className="mt-4"><Notice tone="error">{err}</Notice></div>}
      <button type="button" disabled={pending} className="mt-6 w-full rounded-2xl bg-[#E51F2B] py-4 text-lg font-black text-white shadow-[0_5px_0_#7a0c14] disabled:opacity-60"
        onClick={() => start(async () => { const r = await createPrivateWall(brick); if (r.ok) router.refresh(); else setErr(r.error); })}>
        {pending ? "Building your wall…" : "Create my wall"}
      </button>
    </main>
  );
}

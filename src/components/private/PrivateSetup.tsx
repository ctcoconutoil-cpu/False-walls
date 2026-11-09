"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Notice } from "@/components/ui";
import { createPrivateWall } from "@/lib/actions/private";
import { BRICK_COLOURS, type BrickKey } from "@/lib/constants";
import { BrickSwatch } from "@/components/private/BrickSwatch";
import { cx } from "@/lib/utils";

/** First visit to /private: pick a brick and the wall is created. */
export function PrivateSetup({ username, second = false }: { username: string; second?: boolean }) {
  const router = useRouter();
  const [brick, setBrick] = useState<BrickKey>("bk-red");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <main className="mx-auto max-w-md px-4 py-8" data-nopad="">
      <h1 className="text-3xl">{second ? "Your second private wall" : "Your private wall"}</h1>
      <p className="mt-2 text-chalk-dim">A brick wall of your own. Share one link, and anyone can open your notes and engage. No sign-up needed.</p>
      <p className="mt-3 rounded-xl bg-night-2 px-3 py-2 text-sm">Your link will be <b className="break-all text-mustard">/u/{second ? `${username.toLowerCase()}_2` : username.toLowerCase()}</b></p>
      <h2 className="mb-3 mt-6 text-lg">Pick your brick</h2>
      <div className="grid grid-cols-3 gap-3">
        {BRICK_COLOURS.map((b) => (
          <button key={b.key} type="button" aria-pressed={brick === `bk-${b.key}`} onClick={() => setBrick(`bk-${b.key}`)}
            className={cx("grid gap-1.5 rounded-xl border-2 p-2 text-xs font-bold", brick === `bk-${b.key}` ? "border-mustard text-mustard" : "border-night-3 text-chalk")}>
            <BrickSwatch k={`bk-${b.key}`} className="h-16 rounded-lg" />{b.name}
          </button>
        ))}
      </div>
      {err && <div className="mt-4"><Notice tone="error">{err}</Notice></div>}
      <button type="button" disabled={pending} className="mt-6 w-full rounded-2xl bg-[#E51F2B] py-4 text-lg font-black text-white shadow-[0_5px_0_#7a0c14] disabled:opacity-60"
        onClick={() => start(async () => { const r = await createPrivateWall(brick); if (r.ok) { router.replace(second ? `/private?w=${username.toLowerCase().slice(0, 27)}_2` : "/private"); router.refresh(); } else setErr(r.error); })}>
        {pending ? "Building your wall…" : "Create my wall"}
      </button>
    </main>
  );
}

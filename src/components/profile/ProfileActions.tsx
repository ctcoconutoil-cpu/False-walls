"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Notice, Sheet } from "@/components/ui";
import { ReportButton } from "@/components/wall/Interactions";
import { setBlock, setFollow } from "@/lib/actions/social";

export function ProfileActions({ userId, following, allowFollows, loggedIn }: { userId: string; following: boolean; allowFollows: boolean; loggedIn: boolean }) {
  const router = useRouter();
  const [isF, setF] = useState(following);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!loggedIn) return <Button tone="mustard" onClick={() => router.push("/login")}>Log in to follow</Button>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {allowFollows ? (
        <Button tone={isF ? "ghost" : "mustard"} disabled={pending} aria-pressed={isF} onClick={() => start(async () => { const r = await setFollow(userId, !isF); if (r.ok) { setF(!isF); router.refresh(); } else setErr(r.error); })}>{isF ? "Following" : "Follow"}</Button>
      ) : <span className="rounded-xl bg-night-3 px-3 py-2 text-sm text-chalk-dim">Follows are off</span>}
      <Button tone="ghost" onClick={() => setOpen(true)} aria-label="More options">•••</Button>
      {err && <Notice tone="error">{err}</Notice>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Manage this person">
        <div className="space-y-3">
          <Button tone="ghost" className="w-full" disabled={pending} onClick={() => start(async () => { await setBlock(userId, "mute"); setOpen(false); router.refresh(); })}>Mute. Hide their walls from you quietly.</Button>
          <Button tone="danger" className="w-full" disabled={pending} onClick={() => start(async () => { await setBlock(userId, "block"); setOpen(false); router.push("/maze"); })}>Block. You can't see or contact each other.</Button>
          <div className="text-center"><ReportButton type="user" id={userId} label="Report this person" /></div>
        </div>
      </Sheet>
    </div>
  );
}

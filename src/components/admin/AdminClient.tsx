"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Notice, inputCls } from "@/components/ui";
import { adminSaveBadge, adminSavePrompt, modDismiss, modLookupSender, modRemove, modRestore, modSetRole, modSetUserStatus, modSuppressTrending } from "@/lib/actions/admin";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText = "Done.") =>
    start(async () => { const r = await fn(); setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Failed." }); if (r.ok) router.refresh(); });
  return { pending, msg, run, setMsg };
}

export function ReportActions({ reportId, targetType, targetId, authorId, postId, canRestore, canTrend }: { reportId: string; targetType: string; targetId: string; authorId: string | null; postId?: string; canRestore: boolean; canTrend: boolean }) {
  const { pending, msg, run, setMsg } = useRun();
  const [note, setNote] = useState("");
  const [sender, setSender] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <input aria-label="Moderator note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note for the log (optional)" className={inputCls} />
      <div className="flex flex-wrap gap-2">
        {targetType !== "user" && <Button size="sm" tone="danger" disabled={pending} onClick={() => run(() => modRemove(targetType, targetId, reportId, note), "Content removed.")}>Remove content</Button>}
        {targetType === "user" && <Button size="sm" tone="danger" disabled={pending} onClick={() => run(() => modSetUserStatus(targetId, "suspended", note), "User suspended.")}>Suspend user</Button>}
        {targetType !== "user" && authorId && <Button size="sm" tone="ghost" disabled={pending} onClick={() => run(() => modSetUserStatus(authorId, "suspended", note), "Author suspended.")}>Suspend author</Button>}
        {canRestore && <Button size="sm" tone="ghost" disabled={pending} onClick={() => run(() => modRestore(targetType, targetId, note), "Restored.")}>Restore</Button>}
        {canTrend && postId && <Button size="sm" tone="ghost" disabled={pending} onClick={() => run(() => modSuppressTrending(postId, true), "Hidden from trending.")}>Hide from trending</Button>}
        {targetType === "question" && <Button size="sm" tone="ghost" disabled={pending} onClick={async () => { const r = await modLookupSender(targetId); setMsg(r.ok ? { ok: true, text: `Sender: @${r.sender.username} (${r.sender.status}). This lookup was logged.` } : { ok: false, text: r.error }); if (r.ok) setSender(r.sender.id); }}>Look up sender</Button>}
        {sender && <Button size="sm" tone="danger" disabled={pending} onClick={() => run(() => modSetUserStatus(sender, "suspended", note), "Sender suspended.")}>Suspend sender</Button>}
        <Button size="sm" tone="ghost" disabled={pending} onClick={() => run(() => modDismiss(reportId, note), "Report dismissed.")}>Dismiss report</Button>
      </div>
      {msg && <Notice tone={msg.ok ? "ok" : "error"}>{msg.text}</Notice>}
    </div>
  );
}

export function UserActions({ userId, status, role, isAdmin, self }: { userId: string; status: string; role: string; isAdmin: boolean; self: boolean }) {
  const { pending, msg, run } = useRun();
  if (self) return <span className="text-xs text-chalk-dim">You</span>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "active" ? <Button size="sm" tone="danger" disabled={pending} onClick={() => { if (confirm("Suspend this account?")) run(() => modSetUserStatus(userId, "suspended", "Suspended from users list"), "Suspended."); }}>Suspend</Button>
          : <Button size="sm" tone="teal" disabled={pending} onClick={() => run(() => modSetUserStatus(userId, "active", "Restored from users list"), "Restored.")}>Restore</Button>}
        {isAdmin && (
          <select aria-label="Role" defaultValue={role} disabled={pending} onChange={(e) => run(() => modSetRole(userId, e.target.value as "user" | "moderator" | "admin"), "Role updated.")} className="min-h-10 rounded-lg bg-night-3 px-2 text-sm">
            <option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option>
          </select>
        )}
      </div>
      {msg && <p role="status" className={`text-xs ${msg.ok ? "text-[#9ff0e6]" : "text-[#ffb4b4]"}`}>{msg.text}</p>}
    </div>
  );
}

export function ContentActions({ id, status, suppressed }: { id: string; status: string; suppressed: boolean }) {
  const { pending, msg, run } = useRun();
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {status === "active" ? <Button size="sm" tone="danger" disabled={pending} onClick={() => run(() => modRemove("post", id, null, "Removed from content list"), "Removed.")}>Remove</Button>
          : <Button size="sm" tone="teal" disabled={pending} onClick={() => run(() => modRestore("post", id, "Restored from content list"), "Restored.")}>Restore</Button>}
        <Button size="sm" tone="ghost" disabled={pending} onClick={() => run(() => modSuppressTrending(id, !suppressed), suppressed ? "Can trend again." : "Hidden from trending.")}>{suppressed ? "Allow trending" : "Hide from trending"}</Button>
      </div>
      {msg && <p role="status" className={`text-xs ${msg.ok ? "text-[#9ff0e6]" : "text-[#ffb4b4]"}`}>{msg.text}</p>}
    </div>
  );
}

export function PromptRow({ id, text, active }: { id: string | null; text: string; active: boolean }) {
  const { pending, msg, run } = useRun();
  const [t, setT] = useState(text);
  return (
    <li className="space-y-2 rounded-xl bg-night-2 p-3">
      <input aria-label="Prompt text" value={t} onChange={(e) => setT(e.target.value)} maxLength={200} className={inputCls} placeholder="Write a conversation prompt" />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={pending || t.trim().length < 10} onClick={() => run(() => adminSavePrompt(id, t, active), id ? "Saved." : "Added.")}>{id ? "Save" : "Add prompt"}</Button>
        {id && <Button size="sm" tone="ghost" disabled={pending} onClick={() => run(() => adminSavePrompt(id, t, !active), active ? "Turned off." : "Turned on.")}>{active ? "Turn off" : "Turn on"}</Button>}
        {id && <span className="text-xs text-chalk-dim">{active ? "Active" : "Off"}</span>}
      </div>
      {msg && <p role="status" className={`text-xs ${msg.ok ? "text-[#9ff0e6]" : "text-[#ffb4b4]"}`}>{msg.text}</p>}
    </li>
  );
}

const RULES = [["walls_explored", "Walls explored"], ["reveals", "Hidden content revealed"], ["areas_visited", "Areas visited"], ["conversations_started", "Conversations started"], ["early_finds", "Early finds"]];
export function BadgeRow({ badge }: { badge: { slug: string; name: string; description: string; rule: string; threshold: number; active: boolean } }) {
  const { pending, msg, run } = useRun();
  const [b, setB] = useState(badge);
  return (
    <li className="space-y-2 rounded-xl bg-night-2 p-3">
      <p className="text-xs text-chalk-dim">{b.slug}</p>
      <input aria-label="Badge name" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} maxLength={40} className={inputCls} />
      <input aria-label="Badge description" value={b.description} onChange={(e) => setB({ ...b, description: e.target.value })} maxLength={140} className={inputCls} />
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Rule" value={b.rule} onChange={(e) => setB({ ...b, rule: e.target.value })} className="min-h-10 rounded-lg bg-night-3 px-2 text-sm">{RULES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <input aria-label="Threshold" type="number" min={1} max={1000} value={b.threshold} onChange={(e) => setB({ ...b, threshold: Number(e.target.value) })} className="min-h-10 w-24 rounded-lg bg-night-3 px-2 text-sm" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={b.active} onChange={(e) => setB({ ...b, active: e.target.checked })} className="h-5 w-5 accent-mustard" />Active</label>
        <Button size="sm" disabled={pending} onClick={() => run(() => adminSaveBadge(b), "Saved.")}>Save</Button>
      </div>
      {msg && <p role="status" className={`text-xs ${msg.ok ? "text-[#9ff0e6]" : "text-[#ffb4b4]"}`}>{msg.text}</p>}
    </li>
  );
}

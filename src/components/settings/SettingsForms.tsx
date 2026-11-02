"use client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Avatar, AvatarArt, Button, Field, Notice, inputCls } from "@/components/ui";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { updateProfile, type FormState } from "@/lib/actions/auth";
import { unblockRef, updateSettings } from "@/lib/actions/social";
import { AVATAR_COLORS, AVATAR_STYLES, INTERESTS, LIMITS } from "@/lib/constants";
import type { AuthorLite, Settings } from "@/lib/types";
import { cx } from "@/lib/utils";

export function ProfileForm({ profile, bio, interests }: { profile: AuthorLite; bio: string; interests: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfile, null);
  const [style, setStyle] = useState(profile.avatar_style);
  const [color, setColor] = useState(profile.avatar_color);
  const [picked, setPicked] = useState(interests);
  const [b, setB] = useState(bio);
  const toggle = (i: string) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < 8 ? [...p, i] : p));
  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center gap-4"><Avatar user={{ ...profile, avatar_style: style, avatar_color: color }} size={72} ring="#f3f2fb" /><p className="text-sm text-chalk-dim">@{profile.username}. Usernames can't be changed.</p></div>
      <Field label="Nickname"><input name="display_name" defaultValue={profile.display_name ?? ""} maxLength={30} className={inputCls} /></Field>
      <Field label="Bio" counter={`${b.length}/${LIMITS.bio}`} hint="No emails, phone numbers or addresses."><textarea name="bio" rows={3} maxLength={LIMITS.bio} value={b} onChange={(e) => setB(e.target.value)} className={inputCls} /></Field>
      <input type="hidden" name="avatar_style" value={style} /><input type="hidden" name="avatar_color" value={color} />
      <fieldset><legend className="mb-1 text-sm font-semibold">Avatar shape</legend><div className="flex flex-wrap gap-2">
        {AVATAR_STYLES.map((s) => <button key={s} type="button" aria-label={`Shape ${s}`} aria-pressed={style === s} onClick={() => setStyle(s)} className={cx("overflow-hidden rounded-xl border-4", style === s ? "border-mustard" : "border-transparent")}><AvatarArt style={s} color={color} size={48} /></button>)}
      </div></fieldset>
      <fieldset><legend className="mb-1 text-sm font-semibold">Colour</legend><div className="flex flex-wrap gap-2">
        {AVATAR_COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={cx("h-11 w-11 rounded-full border-4", color === c ? "border-chalk" : "border-night-3")} style={{ background: c }} />)}
      </div></fieldset>
      <ImagePicker name="avatar" label="Profile picture" maxDim={512} maxBytes={LIMITS.avatarBytes} />
      {profile.avatar_url && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="remove_avatar" className="h-5 w-5 accent-mustard" />Remove my current picture</label>}
      <fieldset><legend className="mb-1 text-sm font-semibold">Interests</legend><div className="flex flex-wrap gap-2">
        {INTERESTS.map((i) => <label key={i} className={cx("min-h-10 cursor-pointer rounded-full px-3.5 py-2 text-sm font-bold", picked.includes(i) ? "bg-mustard text-[#2c1e02]" : "bg-night-3")}><input type="checkbox" name="interests" value={i} checked={picked.includes(i)} onChange={() => toggle(i)} className="sr-only" />{i}</label>)}
      </div></fieldset>
      {state?.error && <Notice tone="error">{state.error}</Notice>}
      {state?.notice && <Notice tone="ok">{state.notice}</Notice>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</Button>
    </form>
  );
}

type Row = { key: keyof Settings; label: string; note?: string };
export function ToggleGroup({ rows, settings }: { rows: Row[]; settings: Settings }) {
  const [state, setState] = useState(settings);
  const [err, setErr] = useState<string | null>(null);
  const [, start] = useTransition();
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <label key={r.key} className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl px-1 py-2">
          <span><span className="block font-semibold">{r.label}</span>{r.note && <span className="block text-xs text-chalk-dim">{r.note}</span>}</span>
          <input type="checkbox" role="switch" checked={state[r.key]} className="h-6 w-11 shrink-0 accent-mustard" onChange={(e) => {
            const v = e.target.checked; const prev = state; setState({ ...state, [r.key]: v }); setErr(null);
            start(async () => { const res = await updateSettings({ [r.key]: v }); if (!res.ok) { setState(prev); setErr(res.error); } });
          }} />
        </label>
      ))}
      {err && <Notice tone="error">{err}</Notice>}
    </div>
  );
}

export type BlockRow = { ref: string; kind: string; anonymous: boolean; username: string | null; display_name: string | null; avatar_style: string | null; avatar_color: string | null; avatar_url: string | null };
export function BlockedList({ rows }: { rows: BlockRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!rows.length) return <p className="text-sm text-chalk-dim">You haven't blocked or muted anyone.</p>;
  return (
    <ul className="space-y-2">{rows.map((r) => (
      <li key={r.ref} className="flex items-center justify-between gap-3 rounded-xl bg-night-2 p-3">
        <span className="flex min-w-0 items-center gap-3">
          {r.anonymous ? <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-night-3">?</span> : <Avatar user={{ username: r.username!, display_name: r.display_name, avatar_style: r.avatar_style!, avatar_color: r.avatar_color!, avatar_url: r.avatar_url }} size={36} />}
          <span className="min-w-0"><span className="block truncate font-semibold">{r.anonymous ? "Anonymous sender" : r.display_name || r.username}</span><span className="block text-xs text-chalk-dim">{r.kind === "mute" ? "Muted" : "Blocked"}</span></span>
        </span>
        <Button size="sm" tone="ghost" disabled={pending} onClick={() => start(async () => { await unblockRef(r.ref); router.refresh(); })}>Undo</Button>
      </li>))}
    </ul>
  );
}

export function MotionPref() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => { try { setReduced(localStorage.getItem("fw-motion") === "reduced"); } catch { /* ignore */ } }, []);
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 px-1">
      <span><span className="block font-semibold">Reduce motion</span><span className="block text-xs text-chalk-dim">Turns off wall-opening, bouncing and glow animations. Your device setting is also respected.</span></span>
      <input type="checkbox" role="switch" checked={reduced} className="h-6 w-11 shrink-0 accent-mustard" onChange={(e) => { setReduced(e.target.checked); try { localStorage.setItem("fw-motion", e.target.checked ? "reduced" : "full"); } catch { /* ignore */ } document.documentElement.dataset.motion = e.target.checked ? "reduced" : "full"; }} />
    </label>
  );
}

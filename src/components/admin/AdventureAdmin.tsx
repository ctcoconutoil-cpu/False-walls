"use client";
import { useActionState } from "react";
import { Button, Notice, inputCls } from "@/components/ui";
import { deleteMilestone, deleteObject, deleteProfession, saveMilestone, saveObject, saveProfession } from "@/lib/actions/adventure-admin";
import type { FormState } from "@/lib/actions/auth";
import { AREA_ORDER, AREAS } from "@/lib/constants";
import { adventureImage } from "@/lib/adventure/image";

export type AdminObject = {
  id: string; profession_id: string; name: string; emoji: string; image_path: string | null; rarity: string; area: string; section: number; placement: string; tile_x: number | null; tile_y: number | null;
  visibility: string; per_player: boolean; sort_order: number; active: boolean;
  riddle: { kind: string; prompt: string; hint: string | null; difficulty: number; answers: string[] } | null;
};
export type AdminProfession = { id: string; slug: string; name: string; emoji: string; color: string; blurb: string | null; sort_order: number; active: boolean; starts_at: string | null; ends_at: string | null; objects: AdminObject[] };
export type AdminMilestone = { id: string; slug: string; title: string; description: string; icon: string; color: string; metric: string; threshold: number; reward: string; sort_order: number; active: boolean };

const L = ({ t, children, wide }: { t: string; children: React.ReactNode; wide?: boolean }) => <label className={`block ${wide ? "col-span-2" : ""}`}><span className="mb-1 block text-xs font-semibold text-chalk-dim">{t}</span>{children}</label>;
const Msg = ({ s }: { s: FormState }) => (s?.error ? <Notice tone="error">{s.error}</Notice> : s?.notice ? <Notice tone="ok">{s.notice}</Notice> : null);
const dt = (v: string | null) => (v ? v.slice(0, 16) : "");
const Select = ({ name, def, opts }: { name: string; def: string; opts: [string, string][] }) => <select name={name} defaultValue={def} className={inputCls}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;

function Delete({ action, id, what }: { action: (s: FormState, fd: FormData) => Promise<FormState>; id: string; what: string }) {
  const [s, run, pending] = useActionState(action, null);
  return (
    <form action={run} onSubmit={(e) => { if (!confirm(`Delete this ${what}? This can't be undone.`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} /><Button type="submit" tone="danger" size="sm" disabled={pending}>Delete {what}</Button><Msg s={s} />
    </form>
  );
}

export function ProfessionForm({ p }: { p?: AdminProfession }) {
  const [s, run, pending] = useActionState(saveProfession, null);
  return (
    <form action={run} className="grid grid-cols-2 gap-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <L t="Name"><input name="name" required defaultValue={p?.name} className={inputCls} /></L>
      <L t="Slug (web address)"><input name="slug" required defaultValue={p?.slug} pattern="[a-z0-9-]{2,40}" className={inputCls} /></L>
      <L t="Emoji"><input name="emoji" defaultValue={p?.emoji ?? "🎯"} className={inputCls} /></L>
      <L t="Colour"><input name="color" type="color" defaultValue={p?.color ?? "#F2573F"} className={`${inputCls} h-11 p-1`} /></L>
      <L t="Short description" wide><input name="blurb" defaultValue={p?.blurb ?? ""} className={inputCls} /></L>
      <L t="Sort order"><input name="sort_order" type="number" defaultValue={p?.sort_order ?? 0} className={inputCls} /></L>
      <label className="flex items-end gap-2 pb-3"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-5 w-5" /> Active</label>
      <L t="Opens (optional, limited time)"><input name="starts_at" type="datetime-local" defaultValue={dt(p?.starts_at ?? null)} className={inputCls} /></L>
      <L t="Closes (optional)"><input name="ends_at" type="datetime-local" defaultValue={dt(p?.ends_at ?? null)} className={inputCls} /></L>
      <div className="col-span-2 space-y-2"><Msg s={s} /><Button type="submit" size="sm" disabled={pending}>{p ? "Save profession" : "Add profession"}</Button></div>
    </form>
  );
}

export function ProfessionDelete({ id }: { id: string }) { return <Delete action={deleteProfession} id={id} what="profession" />; }

export function ObjectForm({ professionId, o, nextSort }: { professionId: string; o?: AdminObject; nextSort?: number }) {
  const [s, run, pending] = useActionState(saveObject, null);
  const img = adventureImage(o?.image_path);
  return (
    <div className="space-y-2">
      <form action={run} className="grid grid-cols-2 gap-3" encType="multipart/form-data">
        {o && <input type="hidden" name="id" value={o.id} />}
        <input type="hidden" name="profession_id" value={professionId} />
        <input type="hidden" name="image_path" value={o?.image_path ?? ""} />
        <L t="Object name"><input name="name" required defaultValue={o?.name} className={inputCls} /></L>
        <L t="Emoji (used when there is no picture)"><input name="emoji" defaultValue={o?.emoji ?? "❓"} className={inputCls} /></L>
        <L t="Illustration (PNG, JPG, WebP or SVG, 1 MB max)" wide>
          <span className="flex items-center gap-3">{img && /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt="" width={44} height={44} className="rounded-lg bg-night-3" />}<input type="file" name="image" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="text-sm" /></span>
          {o?.image_path && <span className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="remove_image" /> Remove the uploaded picture</span>}
        </L>
        <L t="Wall (where it is hidden)"><Select name="area" def={o?.area ?? "main"} opts={AREA_ORDER.map((a) => [a, AREAS[a].name])} /></L>
        <L t="Wall section (0 is the first)"><input name="section" type="number" min={0} max={50} defaultValue={o?.section ?? 0} className={inputCls} /></L>
        <L t="Spot beside the wall"><Select name="placement" def={o?.placement ?? "corridor"} opts={[["dead_end", "Dead end"], ["corner", "Corner"], ["junction", "Junction"], ["corridor", "Corridor"], ["room", "Plaza edge"]]} /></L>
        <L t="Visibility"><Select name="visibility" def={o?.visibility ?? "clear"} opts={[["clear", "Easy: glows in the open on the floor"], ["hidden", "Hard: hidden inside a wall, a shade lighter"]]} /></L>
        <L t="Exact tile X (optional; a wall tile for Hard, a floor tile for Easy)"><input name="tile_x" type="number" min={0} max={16} defaultValue={o?.tile_x ?? ""} className={inputCls} /></L>
        <L t="Exact tile Y (optional)"><input name="tile_y" type="number" min={0} max={16} defaultValue={o?.tile_y ?? ""} className={inputCls} /></L>
        <L t="Rarity"><Select name="rarity" def={o?.rarity ?? "common"} opts={[["common", "Common"], ["rare", "Rare (Treasure Hunter)"]]} /></L>
        <L t="Sort order"><input name="sort_order" type="number" defaultValue={o?.sort_order ?? nextSort ?? 0} className={inputCls} /></L>
        <label className="flex items-center gap-2"><input type="checkbox" name="per_player" defaultChecked={o?.per_player} className="h-5 w-5" /> Different spot for each player</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={o?.active ?? true} className="h-5 w-5" /> Active</label>
        <fieldset className="col-span-2 grid grid-cols-2 gap-3 rounded-xl border-2 border-night-3 p-3">
          <legend className="px-1 text-sm font-bold">Mission (leave the text blank for a plain hunt with no riddle)</legend>
          <L t="Type"><Select name="riddle_kind" def={o?.riddle?.kind ?? "riddle"} opts={[["riddle", "Riddle (guess it)"], ["silhouette", "Silhouette (guess the shadow)"], ["direct", "Direct clue (nothing to solve)"]]} /></L>
          <L t="Difficulty"><Select name="riddle_difficulty" def={String(o?.riddle?.difficulty ?? 1)} opts={[["1", "Easy"], ["2", "Medium"], ["3", "Hard"]]} /></L>
          <L t="Riddle or clue text" wide><textarea name="riddle_prompt" rows={2} maxLength={300} defaultValue={o?.riddle?.prompt ?? ""} className={inputCls} /></L>
          <L t="Hint (optional)" wide><input name="riddle_hint" defaultValue={o?.riddle?.hint ?? ""} className={inputCls} /></L>
          <L t="Accepted answers, comma separated (the object name always counts)" wide><input name="riddle_answers" defaultValue={o?.riddle?.answers.join(", ") ?? ""} className={inputCls} /></L>
        </fieldset>
        <div className="col-span-2 space-y-2"><Msg s={s} /><Button type="submit" size="sm" disabled={pending}>{o ? "Save object" : "Add object"}</Button></div>
      </form>
      {o && <Delete action={deleteObject} id={o.id} what="object" />}
    </div>
  );
}

const METRICS: [string, string][] = [["objects", "Objects collected"], ["riddles", "Riddles solved"], ["collections", "Collections completed"], ["team_collections", "Team collections completed"], ["sections", "Different walls explored"], ["rare", "Rare objects found"], ["challenges", "Challenges completed"]];

export function MilestoneForm({ m }: { m?: AdminMilestone }) {
  const [s, run, pending] = useActionState(saveMilestone, null);
  return (
    <div className="space-y-2">
      <form action={run} className="grid grid-cols-2 gap-3">
        {m && <input type="hidden" name="id" value={m.id} />}
        <L t="Title"><input name="title" required defaultValue={m?.title} className={inputCls} /></L>
        <L t="Slug"><input name="slug" required defaultValue={m?.slug} pattern="[a-z0-9_-]{2,40}" className={inputCls} /></L>
        <L t="Description" wide><input name="description" defaultValue={m?.description} className={inputCls} /></L>
        <L t="Icon (emoji)"><input name="icon" defaultValue={m?.icon ?? "★"} className={inputCls} /></L>
        <L t="Colour"><input name="color" type="color" defaultValue={m?.color ?? "#F7B538"} className={`${inputCls} h-11 p-1`} /></L>
        <L t="Requirement"><Select name="metric" def={m?.metric ?? "objects"} opts={METRICS} /></L>
        <L t="Amount needed"><input name="threshold" type="number" min={1} required defaultValue={m?.threshold ?? 1} className={inputCls} /></L>
        <L t="Reward"><Select name="reward" def={m?.reward ?? "badge"} opts={[["badge", "Achievement badge"], ["fire", "Unlocks the Animated Fire"]]} /></L>
        <L t="Sort order"><input name="sort_order" type="number" defaultValue={m?.sort_order ?? 0} className={inputCls} /></L>
        <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={m?.active ?? true} className="h-5 w-5" /> Active</label>
        <div className="col-span-2 space-y-2"><Msg s={s} /><Button type="submit" size="sm" disabled={pending}>{m ? "Save milestone" : "Add milestone"}</Button></div>
      </form>
      {m && <Delete action={deleteMilestone} id={m.id} what="milestone" />}
    </div>
  );
}

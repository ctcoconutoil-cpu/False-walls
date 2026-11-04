"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Field, Notice, inputCls } from "@/components/ui";
import { createPrivateWall } from "@/lib/actions/share";
import { LIMITS, WALL_COLORS, WALL_ICONS } from "@/lib/constants";
import type { WallColor } from "@/lib/types";
import { cx } from "@/lib/utils";

const PICK_DEFAULTS = [
  "Someone I still think about, even though it's complicated",
  "Something I'm afraid people would judge me for",
  "Someone I wish I could talk to one more time",
  "Something that still hurts when it comes up",
  "Something I need closure on",
  "A mistake that still affects how I see myself",
  "A feeling I try to push away but can't",
  "A truth I've never fully said out loud",
  "A part of myself I usually keep hidden",
  "What I'm struggling with right now",
];

/** Makes a private wall that only people with its link can open. */
export function PrivateWallForm({ anonymousAllowed }: { anonymousAllowed: boolean }) {
  const router = useRouter();
  const [template, setTemplate] = useState<"pick_number" | null>("pick_number");
  const [title, setTitle] = useState("Pick a number! I'll be real");
  const [body, setBody] = useState("No overthinking. It's anonymous.");
  const [options, setOptions] = useState<string[]>(PICK_DEFAULTS);
  const [color, setColor] = useState<WallColor>("violet");
  const [icon, setIcon] = useState("");
  const [anon, setAnon] = useState(anonymousAllowed);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(t: "pick_number" | null) {
    setTemplate(t);
    setTitle(t ? "Pick a number! I'll be real" : "Ask me anything");
    setBody(t ? "No overthinking. It's anonymous." : "");
  }
  function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    start(async () => {
      const r = await createPrivateWall({ title, body, template, options, color, icon, anonymous: anon });
      if (!r.ok) { setErr(r.error); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      router.push(`/post/${r.id}?new=1`);
    });
  }
  const c = WALL_COLORS[color];

  return (
    <form onSubmit={submit} className="space-y-6">
      {err && <Notice tone="error">{err}</Notice>}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Style</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["pick_number", "Pick a number", "Numbered prompts. People pick one."], [null, "Ask me", "One open box for questions."]] as const).map(([t, label, note]) => (
            <label key={label} className={cx("cursor-pointer rounded-xl border-2 p-3", template === t ? "border-mustard bg-night-2" : "border-night-3")}>
              <input type="radio" name="style" checked={template === t} onChange={() => choose(t)} className="sr-only" />
              <span className="display block text-lg">{label}</span><span className="block text-xs text-chalk-dim">{note}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Title" counter={`${title.length}/${LIMITS.title}`}><input required minLength={3} maxLength={LIMITS.title} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} /></Field>
      <Field label="Line under the title (optional)" counter={`${body.length}/300`}><input maxLength={300} value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} /></Field>

      {template && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold">Numbered options</legend>
          <p className="text-sm text-chalk-dim">Edit them to anything you like. Use 3 to 10. Empty lines are dropped.</p>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <span aria-hidden className="display grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-night-3">{i + 1}</span>
              <input aria-label={`Option ${i + 1}`} maxLength={80} value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
            </div>
          ))}
          {options.length < 10 && <Button type="button" tone="ghost" size="sm" onClick={() => setOptions([...options, ""])}>Add option</Button>}
        </fieldset>
      )}

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Wall icon</legend>
        <div className="flex flex-wrap gap-2">
          <label className={cx("grid h-12 min-w-12 cursor-pointer place-items-center rounded-xl border-2 px-2 text-xs font-bold", icon === "" ? "border-mustard bg-night-3" : "border-night-3")}>
            <input type="radio" name="wall_icon" checked={icon === ""} onChange={() => setIcon("")} className="sr-only" />Default
          </label>
          {WALL_ICONS.map((ic) => (
            <label key={ic} className={cx("grid h-12 w-12 cursor-pointer place-items-center rounded-xl border-2 text-2xl", icon === ic ? "border-mustard bg-night-3" : "border-night-3")}>
              <input type="radio" name="wall_icon" checked={icon === ic} onChange={() => setIcon(ic)} className="sr-only" /><span aria-hidden>{ic}</span><span className="sr-only">Icon {ic}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset><legend className="mb-2 text-sm font-semibold">Wall colour</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(WALL_COLORS) as WallColor[]).map((k) => (
            <label key={k} className={cx("grid h-11 w-11 cursor-pointer place-items-center rounded-full border-4", color === k ? "border-chalk" : "border-night-3")} style={{ background: WALL_COLORS[k].base }}>
              <input type="radio" name="wall_color" checked={color === k} onChange={() => setColor(k)} className="sr-only" /><span className="sr-only">{WALL_COLORS[k].name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className={cx("flex items-start gap-3 rounded-xl border-2 p-3", anonymousAllowed ? "border-night-3" : "border-night-3 opacity-60")}>
        <input type="checkbox" checked={anon && anonymousAllowed} disabled={!anonymousAllowed} onChange={(e) => setAnon(e.target.checked)} className="mt-1 h-5 w-5 accent-mustard" />
        <span><span className="block font-bold">Let people send anonymously</span><span className="block text-xs text-chalk-dim">{anonymousAllowed ? "You never see who sent a message. You can reject, delete, report or block." : "Anonymous messages are turned off in your settings."}</span></span>
      </label>

      <section aria-labelledby="pv" className="space-y-2 rounded-2xl p-4 text-center" style={{ background: c.base, color: c.ink }}>
        <h2 id="pv" className="display text-sm uppercase opacity-80">Preview</h2>
        <p className="display text-2xl uppercase leading-tight">{title || "Your title"}</p>
        {body && <p className="text-sm font-medium opacity-85">{body}</p>}
        {template && <p className="text-xs font-bold opacity-80">{options.filter((o) => o.trim()).length} numbered options</p>}
      </section>

      <div className="rounded-xl bg-night-2 p-3 text-sm text-chalk-dim"><strong className="text-chalk">Private link wall.</strong> It never appears on the Wall, Discover or search. Only people who have your link can open it, and they need a free account to send you something.</div>
      <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating…" : "Create and get my link"}</Button>
    </form>
  );
}

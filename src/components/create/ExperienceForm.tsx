"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field, Notice, inputCls } from "@/components/ui";
import { createExperience } from "@/lib/actions/discover";
import { EXPERIENCE_CATEGORIES } from "@/lib/constants";

export function ExperienceForm() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [d, setD] = useState({ title: "", description: "" });
  return (
    <form ref={form} className="space-y-5" onSubmit={(e) => {
      e.preventDefault(); setErr(null);
      const fd = new FormData(e.currentTarget);
      // Turn the local date and time into one absolute moment so every viewer sees it in their own zone.
      const when = String(fd.get("when") ?? "");
      fd.delete("when");
      if (scheduled && when) fd.set("starts_at", new Date(when).toISOString());
      start(async () => { const r = await createExperience(fd); if (r.ok) router.push("/discover?tab=experiences"); else setErr(r.error); });
    }}>
      <h1 className="text-3xl uppercase">New experience</h1>
      <p className="text-sm text-chalk-dim">Something people can do, watch or go to. It appears in Discover with a button to your link.</p>
      <Field label="Title" counter={`${d.title.length}/80`}><input name="title" required minLength={2} maxLength={80} className={inputCls} placeholder="Friday board game night" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} autoComplete="off" /></Field>
      <Field label="Description" counter={`${d.description.length}/600`}><textarea name="description" required minLength={10} maxLength={600} rows={4} className={inputCls} placeholder="What is it, who is it for, what should people bring?" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></Field>
      <Field label="Category">
        <select name="category" required defaultValue="" className={inputCls}>
          <option value="" disabled>Choose one</option>
          {Object.entries(EXPERIENCE_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <Field label="Picture" hint="JPG, PNG or WebP.">
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required className={inputCls} onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="Preview" className="mt-2 aspect-[16/10] w-full rounded-xl object-cover" />}
      </Field>
      <Field label="Link" hint="Where people go to join, watch or buy. Must start with https://"><input name="url" type="url" required className={inputCls} placeholder="https://" inputMode="url" autoComplete="off" /></Field>
      <label className="flex min-h-11 items-center gap-3 font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#F9A719]" checked={scheduled} onChange={(e) => setScheduled(e.target.checked)} /> This happens at a set date and time</label>
      {scheduled && <Field label="Date and time" hint="Shown to everyone in their own time zone."><input name="when" type="datetime-local" required className={inputCls} /></Field>}
      {err && <Notice tone="error">{err}</Notice>}
      <button type="submit" disabled={pending} className="btn-press w-full rounded-2xl bg-[#E51F2B] py-3.5 text-lg font-extrabold text-white shadow-[0_5px_0_#7a0f16] disabled:opacity-60">{pending ? "Publishing…" : "Publish experience"}</button>
    </form>
  );
}

"use client";
import { useActionState, useState } from "react";
import { Avatar, AvatarArt, Button, Field, Notice, Wordmark, inputCls } from "@/components/ui";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { completeOnboarding, type FormState } from "@/lib/actions/auth";
import { AVATAR_COLORS, AVATAR_STYLES, INTERESTS, LIMITS } from "@/lib/constants";
import { cx } from "@/lib/utils";

export function OnboardingForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(completeOnboarding, null);
  const [style, setStyle] = useState<string>("blob");
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (i: string) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < 8 ? [...p, i] : p));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-md space-y-6 px-5 py-8">
      <Wordmark size="sm" />
      <div>
        <h1 className="text-3xl">Make your mark</h1>
        <p className="mt-1 text-chalk-dim">Pick how you'll appear on the walls. A nickname is fine. You can change all of this later except your date of birth.</p>
      </div>
      <form action={action} className="space-y-6">
        <section aria-labelledby="who" className="space-y-4">
          <h2 id="who" className="text-xl">Who are you?</h2>
          <Field label="Username" hint="3 to 20 letters, numbers or underscores. This is public.">
            <input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" autoCapitalize="none" autoComplete="off" value={name} onChange={(e) => setName(e.target.value.toLowerCase())} className={inputCls} />
          </Field>
          <Field label="Nickname (optional)" hint="Shown next to your username. Don't use your real full name if you'd rather not.">
            <input name="display_name" maxLength={30} className={inputCls} />
          </Field>
          <Field label="Date of birth" hint="Used once to check you're 13 or over and to choose safer defaults for under-18s. We don't store it or show it to anyone.">
            <input name="birth_date" type="date" required max={today} min="1900-01-01" className={inputCls} />
          </Field>
        </section>

        <section aria-labelledby="look" className="space-y-4">
          <h2 id="look" className="text-xl">Your avatar</h2>
          <div className="flex items-center gap-4">
            <Avatar user={{ username: name || "you", avatar_style: style, avatar_color: color, avatar_url: null }} size={88} ring="#f3f2fb" />
            <p className="text-sm text-chalk-dim">This is you in the maze.</p>
          </div>
          <input type="hidden" name="avatar_style" value={style} /><input type="hidden" name="avatar_color" value={color} />
          <fieldset><legend className="mb-1 text-sm font-semibold">Shape</legend>
            <div className="flex flex-wrap gap-2">
              {AVATAR_STYLES.map((s) => (
                <button key={s} type="button" onClick={() => setStyle(s)} aria-pressed={style === s} aria-label={`Avatar shape ${s}`} className={cx("overflow-hidden rounded-xl border-4", style === s ? "border-mustard" : "border-transparent")}>
                  <AvatarArt style={s} color={color} size={52} />
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset><legend className="mb-1 text-sm font-semibold">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-pressed={color === c} aria-label={`Colour ${c}`} className={cx("h-11 w-11 rounded-full border-4", color === c ? "border-chalk" : "border-night-3")} style={{ background: c }} />
              ))}
            </div>
          </fieldset>
          <ImagePicker name="avatar" label="Or upload a profile picture (optional)" maxDim={512} maxBytes={LIMITS.avatarBytes} hint="JPEG, PNG or WebP up to 2 MB. Location data is removed automatically." />
        </section>

        <section aria-labelledby="about" className="space-y-4">
          <h2 id="about" className="text-xl">About you</h2>
          <Field label="Short bio (optional)" counter={`${bio.length}/${LIMITS.bio}`} hint="Please don't include emails, phone numbers or addresses.">
            <textarea name="bio" rows={3} maxLength={LIMITS.bio} value={bio} onChange={(e) => setBio(e.target.value)} className={inputCls} />
          </Field>
          <fieldset><legend className="mb-1 text-sm font-semibold">Interests (up to 8)</legend>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => (
                <label key={i} className={cx("min-h-10 cursor-pointer rounded-full px-3.5 py-2 text-sm font-bold", picked.includes(i) ? "bg-mustard text-[#2c1e02]" : "bg-night-3")}>
                  <input type="checkbox" name="interests" value={i} checked={picked.includes(i)} onChange={() => toggle(i)} className="sr-only" />{i}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <Notice>Under-18 accounts start private: not listed in search and not open to anonymous questions from adults. You can review every setting later.</Notice>
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "Building your profile…" : "Enter the maze"}</Button>
      </form>
    </main>
  );
}

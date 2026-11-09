"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button, Field, Notice, inputCls } from "@/components/ui";
import { FramePreview } from "@/components/create/FramePreview";
import { ImagePicker } from "@/components/ui/ImagePicker";
import { IconPicker } from "@/components/create/IconPicker";
import { WallCard } from "@/components/wall/WallCard";
import { WallItem } from "@/components/maze/WallItem";
import type { WallPost } from "@/lib/data/wall";
import { createPost } from "@/lib/actions/posts";
import { CLUE_STYLES, FALSE_WALL_KINDS, LIMITS, MAX_WALL_WORDS, PICK_MARK, PICK_MAX, POST_TYPES, WALL_COLORS, WALL_COLOR_CHOICES, wordCount } from "@/lib/constants";
import type { ClueStyle, FalseWallKind, PostType, WallColor } from "@/lib/types";
import { cx } from "@/lib/utils";

const SUGGEST: Record<PostType, string[]> = {
  ask_me: ["Ask Me Anything", "Roast Me", "Spill It", "Ask Me Why", "Be Honest", "Dare Me", "Judge Me", "Ask Away", "Truth Time", "No Filter"],
  picture: ["Good Vibes", "Golden Hour", "Weekend Mood", "Caption This", "Main Character", "Throwback", "Fresh Fit", "Hidden Gem", "City Lights", "Pure Joy", "Last Night", "Soft Life"],
  hidden_thought: ["Hidden Thoughts", "Secret Crush", "Unsent Message", "Confession Time", "Never Said", "Late Night", "Guilty Pleasure", "Small Secret", "Deep Down", "Dear You"],
  prompt_response: ["Hot Take", "Travel", "Coffee Talk", "Best Advice", "Worst Habit", "Dream Job", "Unpopular Opinion", "Favourite Memory", "Red Flag", "Green Flag"],
  false_wall: ["What Should I Do?", "Pick One", "Truth Time", "Guess Why", "Spot It", "Real Or Fake", "Which One", "Would You?", "Help Me Choose", "Plot Twist"],
};
/** Words beyond the third are refused as you type, so the wall text can never run long. */
function clampWords(v: string): string { const parts = v.replace(/\s+/g, " ").split(" "); const filled = parts.filter(Boolean); return filled.length > MAX_WALL_WORDS ? filled.slice(0, MAX_WALL_WORDS).join(" ") : parts.join(" ").replace(/^ /, ""); }

type Props = { wall?: { id: string; slug: string } | null; pick?: boolean; type: PostType; label: string; prompts: { id: string; text: string }[]; isTeen: boolean; anonymousAllowed: boolean; chainParent: string | null; chainAnswer: string | null; chainTitle: string | null; initialPrompt: string | null };

export function CreateForm({ wall = null, pick = false, type, label, prompts, isTeen, anonymousAllowed, chainParent, chainAnswer, chainTitle, initialPrompt }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [clue, setClue] = useState(""); const [hidden, setHidden] = useState("");
  const [color, setColor] = useState<WallColor>(type === "ask_me" ? "mustard" : type === "hidden_thought" ? "violet" : type === "picture" ? "slate" : type === "false_wall" ? "sky" : "coral");
  const [icon, setIcon] = useState("");
  const [kind, setKind] = useState<FalseWallKind>("story"); const [style, setStyle] = useState<ClueStyle>("crack");
  const [prompt, setPrompt] = useState<string>(initialPrompt ?? prompts[0]?.id ?? "");
  const [options, setOptions] = useState(["", ""]); const [pollQ, setPollQ] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers">(isTeen ? "followers" : "public");
  const [reveal, setReveal] = useState<"anyone" | "followers">("anyone");
  const [images, setImages] = useState(0);
  const [picUrl, setPicUrl] = useState<string | null>(null);
  const forPrivate = !!wall;
  const [questions, setQuestions] = useState(["", ""]);
  const needsImages = type === "picture" || (type === "false_wall" && kind === "photo");
  const concealed = type === "hidden_thought" || type === "false_wall";

  const preview = useMemo(() => ({
    id: "preview", author_id: null, type, title: forPrivate ? (title || (pick ? "Pick a number" : null)) : title || "Your words", body: pick ? PICK_MARK + (questions.filter((q) => q.trim()).join("\n") || "…\n…") : forPrivate ? body || null : null, clue: clue || null, prompt_id: null, false_wall_kind: kind, clue_style: style, wall_color: color, wall_icon: icon || null,
    visibility, reveal_mode: reveal, allow_anonymous_questions: true, allow_replies: true, allow_chains: true, area_slug: "main", is_sample: false, status: "active",
    created_at: new Date().toISOString(), author: null, media: [], likes: 0, comments: 0,
  }) as unknown as WallPost, [type, title, body, clue, kind, style, color, icon, visibility, reveal, forPrivate, pick, questions]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (wall) { fd.set("wall", wall.id); fd.set("visibility", isTeen ? "followers" : "public"); }
    if (pick) {
      const qs = questions.map((q) => q.trim()).filter(Boolean);
      if (qs.length < 2) { setError("Add at least two questions."); return; }
      fd.set("body", PICK_MARK + qs.join("\n"));
    }
    fd.set("type", type);
    start(async () => {
      const r = await createPost(fd);
      if (!r.ok) { setError(r.error); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      router.push(wall ? `/private?w=${wall.slug}` : `/post/${r.id}`);
    });
  }

  const pollReady = options.filter((o) => o.trim()).length >= 2;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <Link href="/create" className="text-sm text-chalk-dim underline">‹ All wall types</Link>
        <h1 className="mt-1 text-3xl">{type === "false_wall" ? "Build a False Wall" : pick ? "Pick a number" : label}</h1>
        <p className="mt-1 text-chalk-dim">{pick ? "A list of numbered questions. People tap a number and answer. No sign-up needed." : POST_TYPES[type].blurb}</p>
      </div>
      {chainParent && <Notice>Related wall: this will link to “{chainTitle ?? "the original wall"}”.<input type="hidden" name="chain_parent" value={chainParent} />{chainAnswer && <input type="hidden" name="chain_answer" value={chainAnswer} />}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {forPrivate ? (
        <>
          {(type === "ask_me" || type === "picture") && (
            <Field label={pick ? "What is it about?" : type === "picture" ? "Caption" : "What should people ask you about?"} counter={`${title.length}/80`}>
              <input name="title" required minLength={3} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder={pick ? "Pick a number, any number" : type === "picture" ? "Golden hour" : "Ask me anything"} autoComplete="off" />
            </Field>
          )}
        </>
      ) : (
      <section aria-labelledby="onwall" className="space-y-4 rounded-2xl bg-night-2 p-4">
        <h2 id="onwall" className="text-lg">On the wall</h2>
        <Field label="Your words (1 to 3)" counter={`${wordCount(title)}/${MAX_WALL_WORDS} words`} hint="Short and bold. This is what everyone sees on the wall; the rest goes inside the post.">
          <input name="title" required maxLength={36} value={title} onChange={(e) => setTitle(clampWords(e.target.value))} className={inputCls} placeholder="Ask Me Anything" autoComplete="off" />
        </Field>
        <Chips items={SUGGEST[type]} onPick={setTitle} />
        <IconPicker value={icon} onChange={setIcon} />
      </section>
      )}

      {pick && (
        <fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">Your numbered questions (2 to {PICK_MAX})</legend>
          {questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2">
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mustard font-black text-[#2c1e02]">{i + 1}</span>
              <input aria-label={`Question ${i + 1}`} maxLength={140} value={q} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} placeholder={`Question ${i + 1}`} />
            </div>
          ))}
          {questions.length < PICK_MAX && <Button type="button" tone="ghost" size="sm" onClick={() => setQuestions([...questions, ""])}>Add a question</Button>}
        </fieldset>
      )}

      {type === "ask_me" && !pick && (
        <>
          <Field label="More detail (optional)" counter={`${body.length}/${LIMITS.body}`}><textarea name="body" rows={3} maxLength={LIMITS.body} value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} /></Field>
        </>
      )}

      {type === "hidden_thought" && (
        <>
          <Field label="What people see first" counter={`${body.length}/${LIMITS.body}`} hint="The part you're happy to show.">
            <textarea name="body" rows={2} maxLength={LIMITS.body} value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} placeholder="There's something I wish I could tell people…" />
          </Field>
          <Field label="Clue" counter={`${clue.length}/${LIMITS.clue}`} hint="A hint about what's hidden. Shown before anyone opens it.">
            <input name="clue" required minLength={3} maxLength={LIMITS.clue} value={clue} onChange={(e) => setClue(e.target.value)} className={inputCls} />
          </Field>
          <Field label="The hidden part" counter={`${hidden.length}/${LIMITS.hidden}`}>
            <textarea name="hidden_text" required rows={5} maxLength={LIMITS.hidden} value={hidden} onChange={(e) => setHidden(e.target.value)} className={inputCls} />
          </Field>
        </>
      )}

      {type === "picture" && (
        <>
          <ImagePicker name="images" label="Pictures" max={LIMITS.images} maxBytes={LIMITS.imageBytes} hint="Up to 4 JPEG, PNG or WebP images. They're shrunk automatically and location data is removed." onFiles={setImages} onPreviews={(u) => setPicUrl(u[0] ?? null)} />
          {picUrl && <FramePreview src={picUrl} color={color} onColor={setColor} />}
          <Field label="Describe it for people who can't see it (optional)" hint="Alt text helps screen reader users."><input name="alt" maxLength={200} className={inputCls} /></Field>
          <Field label="More detail (optional)"><textarea name="body" rows={2} maxLength={LIMITS.body} value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} /></Field>
        </>
      )}

      {type === "prompt_response" && (
        <>
          <fieldset><legend className="mb-2 text-sm font-semibold">Pick a prompt</legend>
            <div className="space-y-2">
              {prompts.map((p) => (
                <label key={p.id} className={cx("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-2.5", prompt === p.id ? "border-mustard bg-night-2" : "border-night-3")}>
                  <input type="radio" name="prompt_id" value={p.id} checked={prompt === p.id} onChange={() => setPrompt(p.id)} className="h-4 w-4 accent-mustard" />{p.text}
                </label>
              ))}
              {!prompts.length && <Notice>No prompts are available right now.</Notice>}
            </div>
            {prompts.length > 1 && <Button type="button" tone="ghost" size="sm" className="mt-2" onClick={() => setPrompt(prompts[Math.floor(Math.random() * prompts.length)].id)}>Shuffle</Button>}
          </fieldset>
          <Field label="Your answer" counter={`${body.length}/${LIMITS.body}`}>
            <textarea name="body" required minLength={3} rows={5} maxLength={LIMITS.body} value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} />
          </Field>
          <p className="text-xs text-chalk-dim">Answers that spark real replies from different people can rise onto the Trending Wall.</p>
        </>
      )}

      {type === "false_wall" && (
        <>
          <fieldset><legend className="mb-2 text-sm font-semibold">What's behind the wall?</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FALSE_WALL_KINDS) as FalseWallKind[]).map((k) => (
                <label key={k} className={cx("min-h-11 cursor-pointer rounded-xl px-4 py-2.5 text-sm font-bold", kind === k ? "bg-mustard text-[#2c1e02]" : "bg-night-3")}>
                  <input type="radio" name="false_wall_kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />{FALSE_WALL_KINDS[k]}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset><legend className="mb-2 text-sm font-semibold">How does the wall give itself away?</legend>
            <div className="grid gap-2">
              {(Object.keys(CLUE_STYLES) as ClueStyle[]).map((s) => (
                <label key={s} className={cx("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-2.5", style === s ? "border-mustard bg-night-2" : "border-night-3")}>
                  <input type="radio" name="clue_style" value={s} checked={style === s} onChange={() => setStyle(s)} className="h-4 w-4 accent-mustard" />
                  <span><span className="block font-bold">{CLUE_STYLES[s].label}</span><span className="block text-xs text-chalk-dim">{CLUE_STYLES[s].hint}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Clue on the wall" counter={`${clue.length}/${LIMITS.clue}`} hint="Painted on the outside, like “You probably won't expect this.”">
            <input name="clue" required minLength={3} maxLength={LIMITS.clue} value={clue} onChange={(e) => setClue(e.target.value)} className={inputCls} />
          </Field>
          {kind === "question" && <Field label="The hidden question" counter={`${hidden.length}/${LIMITS.hidden}`}><textarea name="hidden_text" required rows={3} maxLength={LIMITS.hidden} value={hidden} onChange={(e) => setHidden(e.target.value)} className={inputCls} /></Field>}
          {kind === "story" && <Field label="The hidden story" counter={`${hidden.length}/${LIMITS.hidden}`}><textarea name="hidden_text" required rows={6} maxLength={LIMITS.hidden} value={hidden} onChange={(e) => setHidden(e.target.value)} className={inputCls} /></Field>}
          {kind === "conversation" && <Field label="How the conversation starts" hint="People reply in Behind the Wall once they've opened it." counter={`${hidden.length}/${LIMITS.hidden}`}><textarea name="hidden_text" required rows={4} maxLength={LIMITS.hidden} value={hidden} onChange={(e) => setHidden(e.target.value)} className={inputCls} /></Field>}
          {kind === "photo" && (
            <>
              <ImagePicker name="images" label="Hidden pictures" max={LIMITS.images} maxBytes={LIMITS.imageBytes} hint="Only people who open the wall can see these." onFiles={setImages} />
              <Field label="Caption (optional)"><textarea name="hidden_text" rows={2} maxLength={LIMITS.hidden} value={hidden} onChange={(e) => setHidden(e.target.value)} className={inputCls} /></Field>
              <Field label="Describe it for screen readers (optional)"><input name="alt" maxLength={200} className={inputCls} /></Field>
            </>
          )}
          {kind === "poll" && (
            <>
              <Field label="Poll question"><input name="poll_question" maxLength={140} value={pollQ} onChange={(e) => setPollQ(e.target.value)} className={inputCls} /></Field>
              <fieldset className="space-y-2"><legend className="mb-1 text-sm font-semibold">Options (2 to 4)</legend>
                {options.map((o, i) => (
                  <input key={i} name="poll_option" aria-label={`Option ${i + 1}`} maxLength={60} value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} placeholder={`Option ${i + 1}`} />
                ))}
                {options.length < 4 && <Button type="button" tone="ghost" size="sm" onClick={() => setOptions([...options, ""])}>Add option</Button>}
              </fieldset>
            </>
          )}
        </>
      )}

      <fieldset><legend className="mb-2 text-sm font-semibold">Wall colour</legend>
        <div className="flex flex-wrap gap-2">
          {(WALL_COLOR_CHOICES as readonly WallColor[]).map((c) => (
            <label key={c} className={cx("grid h-11 w-11 cursor-pointer place-items-center rounded-full border-4", color === c ? "border-chalk" : "border-night-3")} style={{ background: WALL_COLORS[c].base }}>
              <input type="radio" name="wall_color" value={c} checked={color === c} onChange={() => setColor(c)} className="sr-only" /><span className="sr-only">{WALL_COLORS[c].name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-labelledby="preview" className="space-y-2">
        <h2 id="preview" className="text-lg">Preview</h2>
        {forPrivate
          ? <div className="mx-auto h-[190px] w-[150px]"><WallItem post={preview} compact /></div>
          : <div className="relative mx-auto h-[162px] w-[108px]"><WallCard post={preview} p={{ variant: 0, seed: 0.3 }} /></div>}
      </section>

      <section aria-labelledby="settings" className="space-y-4 rounded-2xl bg-night-2 p-4">
        <h2 id="settings" className="text-lg">Settings</h2>
        <input type="hidden" name="area_slug" value="main" />
        {!forPrivate && (
          <Field label="Who can see it?" hint={isTeen ? "Under-18 accounts default to followers only." : undefined}>
            <select name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "followers")} className={inputCls}>
              <option value="public">Everyone</option><option value="followers">Followers only</option>
            </select>
          </Field>
        )}
        {concealed && !forPrivate && (
          <Field label="Who can open it?" hint="Restricted walls show their clue to people who can see them, but only followers can open what's behind.">
            <select name="reveal_mode" value={reveal} onChange={(e) => setReveal(e.target.value as "anyone" | "followers")} className={inputCls}>
              <option value="anyone">Anyone who can see it</option><option value="followers">Followers only</option>
            </select>
          </Field>
        )}
        {type === "ask_me" && !forPrivate && (
          <Check name="allow_anonymous" label="Allow anonymous questions" defaultChecked={anonymousAllowed} disabled={!anonymousAllowed} note={anonymousAllowed ? "You can block, reject or report anyone, and you never see who sent an anonymous question." : "Anonymous questions are switched off in your settings."} />
        )}
        <Check name="allow_replies" label="Allow replies" defaultChecked />
        <Check name="allow_chains" label="Allow related walls" defaultChecked note="Others can build a connected wall from this one." />
      </section>

      <Button type="submit" size="lg" disabled={pending || wordCount(title) < 1 || !icon || (needsImages && images === 0) || (type === "false_wall" && kind === "poll" && !pollReady)} className="w-full">{pending ? "Publishing…" : "Publish"}</Button>
      {needsImages && images === 0 && <p className="text-center text-xs text-chalk-dim">Add at least one picture to publish.</p>}
    </form>
  );
}

function Chips({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  return (
    <div className="-mt-3 flex flex-wrap gap-2" aria-label="Suggestions">
      {items.map((s) => <button key={s} type="button" onClick={() => onPick(s)} className="min-h-9 rounded-full bg-night-3 px-3 py-1.5 text-xs font-bold">{s}</button>)}
    </div>
  );
}

function Check({ name, label, note, defaultChecked, disabled }: { name: string; label: string; note?: string; defaultChecked?: boolean; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-3">
      {/* Checkbox first: FormData.get returns the first match, so "on" wins when ticked and the
          hidden field only speaks when the box is clear (unchecked boxes send nothing). */}
      <input type="checkbox" name={name} value="on" defaultChecked={defaultChecked && !disabled} disabled={disabled} className="mt-1 h-5 w-5 accent-mustard" />
      <input type="hidden" name={name} value="off" />
      <span><span className="block font-semibold">{label}</span>{note && <span className="block text-xs text-chalk-dim">{note}</span>}</span>
    </label>
  );
}

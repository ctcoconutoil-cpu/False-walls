"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Avatar, Button, Notice, Sheet, inputCls } from "@/components/ui";
import { answerRiddle, createTeam, fetchTeamMessages, inviteToTeam, joinAdventure, leaveTeam, pauseAdventure, respondToInvite, sendTeamMessage } from "@/lib/actions/adventure";
import type { AnswerResult, Person, TeamMessage } from "@/lib/adventure/types";
import { ObjectArt } from "./Bits";
import { cx, timeAgo } from "@/lib/utils";

const LEVELS = ["", "Easy", "Medium", "Hard"];

/** A riddle (or silhouette, or plain clue) with an answer box, a hint and a Check Answer button. */
export function RiddleCard({ riddleId, kind, prompt, hint, difficulty, silhouette, solved, slug, color, title, objectName, objectEmoji, compact }: {
  riddleId: string; kind: "riddle" | "silhouette" | "direct"; prompt: string; hint: string | null; difficulty: number; silhouette?: string | null; solved: boolean;
  slug: string; color: string; title?: string; objectName?: string | null; objectEmoji?: string | null; compact?: boolean;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [res, setRes] = useState<AnswerResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [wrong, setWrong] = useState(false);
  const [pending, start] = useTransition();
  const isSolved = solved || res?.correct;
  const name = res?.object?.name ?? objectName;
  const emoji = res?.object?.emoji ?? objectEmoji;
  const check = () => {
    setErr(null); setWrong(false);
    start(async () => {
      const r = await answerRiddle(riddleId, answer);
      if (!r.ok) { setErr(r.error); return; }
      if (r.result.correct) setRes(r.result); else setWrong(true);
    });
  };
  const hunt = () => start(async () => { const r = await joinAdventure(slug); if (!r.ok) setErr(r.error); else router.push("/wall"); });
  return (
    <article className={cx("rounded-2xl bg-night-2", compact ? "p-3.5" : "p-4")} style={{ borderLeft: `4px solid ${color}` }}>
      <div className="mb-2 flex items-center gap-2 text-xs text-chalk-dim">
        {title && <span className="font-bold" style={{ color }}>{title}</span>}
        <span>{kind === "direct" ? "Clue" : kind === "silhouette" ? "Silhouette" : "Riddle"}</span>
        <span aria-label={`Difficulty ${LEVELS[difficulty]}`}>{"●".repeat(difficulty)}{"○".repeat(3 - difficulty)} {LEVELS[difficulty]}</span>
      </div>
      <div className="flex items-start gap-3">
        {kind === "silhouette" && <ObjectArt found={!!isSolved} emoji={emoji} silhouette={silhouette} size={52} />}
        <p className="text-base">{prompt}</p>
      </div>
      {kind === "direct" || isSolved ? (
        <div className="mt-3 space-y-2">
          {isSolved && kind !== "direct" && <Notice tone="ok">Correct! It's the {emoji} {name}. Find it in the maze.</Notice>}
          {kind === "direct" && name && <p className="text-sm text-chalk-dim">Look for the {emoji} {name}.</p>}
          <Button tone="teal" size="sm" onClick={hunt} disabled={pending}>Hunt it in the maze</Button>
        </div>
      ) : (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); if (answer.trim()) check(); }}>
          <label className="sr-only" htmlFor={`a-${riddleId}`}>Your answer</label>
          <div className="flex gap-2">
            <input id={`a-${riddleId}`} value={answer} onChange={(e) => { setAnswer(e.target.value); setWrong(false); }} maxLength={60} autoComplete="off" placeholder="Your answer" className={inputCls} />
            <Button type="submit" tone="mustard" size="sm" disabled={pending || !answer.trim()}>{pending ? "…" : "Check Answer"}</Button>
          </div>
          {wrong && <p role="status" className="text-sm text-[#ffb4b4]">Not quite. Try again{hint ? " or use the hint." : "."}</p>}
          {err && <Notice tone="error">{err}</Notice>}
          {hint && (showHint ? <p className="text-sm text-mustard">Hint: {hint}</p> : <button type="button" onClick={() => setShowHint(true)} className="text-sm font-bold text-mustard underline">Show a hint</button>)}
        </form>
      )}
    </article>
  );
}

/** Choose solo or a team, then step into the maze. */
export function PlayPanel({ slug, playing, activeTeam, teams, color }: { slug: string; playing: boolean; activeTeam: string | null; teams: { id: string; name: string }[]; color: string }) {
  const router = useRouter();
  const [team, setTeam] = useState<string>(activeTeam ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const go = () => start(async () => { const r = await joinAdventure(slug, team || null); if (!r.ok) setErr(r.error); else router.push("/wall"); });
  const stop = () => start(async () => { await pauseAdventure(); router.refresh(); });
  return (
    <div className="space-y-3 rounded-2xl bg-night-2 p-4">
      {teams.length > 0 && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-sm font-bold">Who are you hunting for?</legend>
          {[{ id: "", name: "Just me (solo)" }, ...teams].map((t) => (
            <label key={t.id} className="flex min-h-11 items-center gap-3 rounded-xl bg-night px-3">
              <input type="radio" name="who" checked={team === t.id} onChange={() => setTeam(t.id)} className="h-5 w-5" style={{ accentColor: color }} />
              <span>{t.id ? `Team: ${t.name}` : t.name}</span>
            </label>
          ))}
        </fieldset>
      )}
      {err && <Notice tone="error">{err}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={go} disabled={pending}>{playing ? "Back to the maze" : "Hunt in the maze"}</Button>
        {playing && <Button tone="ghost" onClick={stop} disabled={pending}>Pause Adventure</Button>}
      </div>
    </div>
  );
}

export function PauseButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button tone="ghost" size="sm" disabled={pending} onClick={() => start(async () => { await pauseAdventure(); router.refresh(); })}>Pause Adventure</Button>;
}

export function InviteButtons({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (accept: boolean) => start(async () => { const r = await respondToInvite(teamId, accept); if (!r.ok) setErr(r.error); else if (accept) router.push(`/adventure/team/${teamId}`); else router.refresh(); });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" tone="teal" disabled={pending} onClick={() => act(true)}>Accept</Button>
      <Button size="sm" tone="ghost" disabled={pending} onClick={() => act(false)}>Decline</Button>
      {err && <span className="text-sm text-[#ffb4b4]">{err}</span>}
    </div>
  );
}

function FriendPicker({ friends, picked, setPicked, max }: { friends: (Person & { id: string })[]; picked: string[]; setPicked: (v: string[]) => void; max: number }) {
  if (friends.length === 0) return <p className="rounded-xl bg-night p-3 text-sm text-chalk-dim">No friends to invite yet. Friends are people you follow who follow you back.</p>;
  return (
    <ul className="max-h-56 space-y-1.5 overflow-y-auto">
      {friends.map((f) => {
        const on = picked.includes(f.id);
        return (
          <li key={f.id}>
            <label className="flex min-h-12 items-center gap-3 rounded-xl bg-night px-3">
              <input type="checkbox" checked={on} disabled={!on && picked.length >= max} onChange={() => setPicked(on ? picked.filter((x) => x !== f.id) : [...picked, f.id])} className="h-5 w-5 accent-[#F2573F]" />
              <Avatar user={f} size={32} /><span className="truncate">{f.display_name || f.username}<span className="text-chalk-dim"> @{f.username}</span></span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

export function NewTeamButton({ slug, professionName, friends, label = "Start a team challenge" }: { slug: string; professionName: string; friends: (Person & { id: string })[]; label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${professionName} crew`);
  const [picked, setPicked] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const make = () => start(async () => { const r = await createTeam(slug, name, picked); if (!r.ok) setErr(r.error); else router.push(`/adventure/team/${r.id}`); });
  return (
    <>
      <Button tone="violet" onClick={() => setOpen(true)}>{label}</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="New team challenge">
        <div className="space-y-4">
          <label className="block"><span className="mb-1 block text-sm font-semibold">Team name</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} className={inputCls} /></label>
          <div><p className="mb-1 text-sm font-semibold">Invite friends (up to 5)</p><FriendPicker friends={friends} picked={picked} setPicked={setPicked} max={5} /></div>
          {err && <Notice tone="error">{err}</Notice>}
          <Button className="w-full" onClick={make} disabled={pending || name.trim().length < 2}>{pending ? "Creating…" : picked.length ? `Create and invite ${picked.length}` : "Create team"}</Button>
        </div>
      </Sheet>
    </>
  );
}

export function TeamTools({ teamId, friends, playing, slug, status }: { teamId: string; friends: (Person & { id: string })[]; playing: boolean; slug: string; status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const invite = () => start(async () => { const r = await inviteToTeam(teamId, picked); if (!r.ok) setMsg({ tone: "error", text: r.error }); else { setMsg({ tone: "ok", text: "Invitations sent." }); setPicked([]); setOpen(false); router.refresh(); } });
  const leave = () => { if (!confirm("Leave this team? Objects you found stay in your collection.")) return; start(async () => { const r = await leaveTeam(teamId); if (!r.ok) setMsg({ tone: "error", text: r.error }); else router.push("/adventure"); }); };
  const play = () => start(async () => { const r = await joinAdventure(slug, teamId); if (!r.ok) setMsg({ tone: "error", text: r.error }); else router.push("/wall"); });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "active" && <Button tone="teal" onClick={play} disabled={pending}>{playing ? "Back to the maze" : "Hunt for the team"}</Button>}
        {status === "active" && <Button tone="violet" onClick={() => setOpen(true)}>Invite friends</Button>}
        <Button tone="danger" onClick={leave} disabled={pending}>Leave team</Button>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Invite friends">
        <div className="space-y-4">
          <FriendPicker friends={friends} picked={picked} setPicked={setPicked} max={5} />
          <Button className="w-full" onClick={invite} disabled={pending || picked.length === 0}>Send invitations</Button>
        </div>
      </Sheet>
    </div>
  );
}

/** Group chat for one team. Polls while the page is open and stops when it is hidden. */
export function TeamChat({ teamId, initial }: { teamId: string; initial: TeamMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const refresh = useCallback(async () => { const r = await fetchTeamMessages(teamId); if (r.ok) setMessages(r.messages); }, [teamId]);
  useEffect(() => {
    const t = window.setInterval(() => { if (!document.hidden) void refresh(); }, 5000);
    return () => window.clearInterval(t);
  }, [refresh]);
  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [messages]);
  const send = () => {
    const body = text.trim(); if (!body) return;
    setErr(null); setText("");
    start(async () => { const r = await sendTeamMessage(teamId, body); if (!r.ok) { setErr(r.error); setText(body); } else { stick.current = true; await refresh(); } });
  };
  return (
    <div className="rounded-2xl bg-night-2">
      <div ref={box} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }} className="max-h-80 min-h-40 space-y-2 overflow-y-auto p-3" role="log" aria-live="polite" aria-label="Team chat">
        {messages.length === 0 && <p className="py-8 text-center text-sm text-chalk-dim">No messages yet. Say hello, or share a clue.</p>}
        {messages.map((m) => m.kind === "discovery" ? (
          <p key={m.id} className="rounded-xl bg-teal/10 px-3 py-1.5 text-center text-sm text-[#9ff0e6]">{m.user?.display_name || m.user?.username || "Someone"} {m.body}</p>
        ) : (
          <div key={m.id} className={cx("flex gap-2", m.mine && "flex-row-reverse")}>
            {m.user && <Avatar user={m.user} size={28} />}
            <div className={cx("max-w-[78%] rounded-2xl px-3 py-2 text-[15px]", m.mine ? "bg-coral text-[#2a0d08]" : "bg-night-3")}>
              {!m.mine && <p className="text-xs font-bold text-mustard">{m.user?.display_name || m.user?.username}</p>}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cx("mt-0.5 text-[10px]", m.mine ? "text-[#2a0d08]/70" : "text-chalk-dim")}>{timeAgo(m.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
      <form className="flex gap-2 border-t border-night-3 p-2.5" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="sr-only" htmlFor="team-msg">Message your team</label>
        <input id="team-msg" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Message your team" autoComplete="off" className={inputCls} />
        <Button type="submit" size="sm" disabled={pending || !text.trim()}>Send</Button>
      </form>
      {err && <p role="alert" className="px-3 pb-2 text-sm text-[#ffb4b4]">{err}</p>}
    </div>
  );
}

export function ChatLink({ teamId, unread, name }: { teamId: string; unread: number; name: string }) {
  return <Link href={`/adventure/team/${teamId}`} className="relative">{name}{unread > 0 && <span aria-label={`${unread} unread`} className="ml-2 inline-grid h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[11px] font-black text-[#2a0d08]">{unread}</span>}</Link>;
}

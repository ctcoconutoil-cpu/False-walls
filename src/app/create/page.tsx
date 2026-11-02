import Link from "next/link";
import { requireMember } from "@/lib/data/session";
import { POST_TYPES, TYPE_TO_ROUTE, WALL_COLORS } from "@/lib/constants";
import type { PostType } from "@/lib/types";

export const metadata = { title: "Create" };
const ORDER: { type: PostType; color: keyof typeof WALL_COLORS }[] = [
  { type: "ask_me", color: "mustard" }, { type: "hidden_thought", color: "rose" }, { type: "picture", color: "sky" },
  { type: "prompt_response", color: "teal" }, { type: "false_wall", color: "violet" },
];

export default async function CreateMenu({ searchParams }: { searchParams: Promise<{ chain_parent?: string; chain_answer?: string }> }) {
  await requireMember("/create");
  const sp = await searchParams;
  const chain = sp.chain_parent ? `?chain_parent=${encodeURIComponent(sp.chain_parent)}${sp.chain_answer ? `&chain_answer=${encodeURIComponent(sp.chain_answer)}` : ""}` : "";
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-3xl uppercase sm:text-4xl">What do you want to put on the wall?</h1>
      {chain && <p className="mt-2 rounded-xl bg-night-2 p-3 text-sm text-chalk-dim">You're building a <strong className="text-chalk">related wall</strong>. It will be linked to the conversation you came from.</p>}
      <ul className="mt-6 grid gap-3">
        {ORDER.map(({ type, color }) => {
          const c = WALL_COLORS[color];
          return (
            <li key={type}>
              <Link href={`/create/${TYPE_TO_ROUTE[type]}${chain}`} className="btn-press flex items-center gap-4 rounded-2xl p-4" style={{ background: c.base, color: c.ink, boxShadow: `0 5px 0 ${c.dark}`, ["--btn-shadow" as string]: c.dark }}>
                <span aria-hidden className="display grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-black/15 text-3xl">{POST_TYPES[type].icon}</span>
                <span><span className="display block text-xl">{type === "false_wall" ? "Build a False Wall" : POST_TYPES[type].label}</span><span className="block text-sm font-medium opacity-85">{POST_TYPES[type].blurb}</span></span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

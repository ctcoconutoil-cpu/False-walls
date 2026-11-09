import { notFound, redirect } from "next/navigation";
import { CreateForm } from "@/components/create/CreateForm";
import { requireMember } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { CREATE_ROUTES, POST_TYPES, PRIVATE_ONLY_TYPES } from "@/lib/constants";
import { isUuid } from "@/lib/utils";

export default async function CreatePage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ chain_parent?: string; chain_answer?: string; prompt?: string; wall?: string }> }) {
  const { type: route } = await params;
  const type = CREATE_ROUTES[route];
  if (!type) notFound();
  const { profile, settings } = await requireMember(`/create/${route}`);
  const sp = await searchParams;
  const supabase = await createClient();
  // Private-wall templates are made from "My private wall" and hang on the wall chosen there.
  const privateType = (PRIVATE_ONLY_TYPES as readonly string[]).includes(type) || route === "pick-number" || (type === "picture" && !!sp.wall);
  let wall: { id: string; slug: string } | null = null;
  if (privateType) {
    const { user } = await requireMember(`/create/${route}`);
    const { data } = sp.wall && isUuid(sp.wall)
      ? await supabase.from("private_walls").select("id, slug").eq("id", sp.wall).eq("owner_id", user.id).maybeSingle()
      : await supabase.from("private_walls").select("id, slug").eq("owner_id", user.id).order("n").limit(1).maybeSingle();
    if (!data) redirect("/private");
    wall = data as { id: string; slug: string };
  }
  const prompts = type === "prompt_response"
    ? ((await supabase.from("random_prompts").select("id,text").eq("active", true).limit(60)).data ?? [])
    : [];
  const chainParent = sp.chain_parent && isUuid(sp.chain_parent) ? sp.chain_parent : null;
  let chainTitle: string | null = null;
  if (chainParent) {
    const { data } = await supabase.from("posts").select("title,clue,body").eq("id", chainParent).maybeSingle();
    chainTitle = data ? (data.title ?? data.clue ?? data.body) : null;
    if (!data) notFound();
  }
  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <CreateForm
        wall={wall} pick={route === "pick-number"} type={type} label={POST_TYPES[type].label} prompts={prompts as { id: string; text: string }[]} isTeen={profile.age_group === "teen"}
        anonymousAllowed={settings.allow_anonymous_questions}
        chainParent={chainParent} chainAnswer={sp.chain_answer && isUuid(sp.chain_answer) ? sp.chain_answer : null} chainTitle={chainTitle}
        initialPrompt={sp.prompt && isUuid(sp.prompt) ? sp.prompt : null}
      />
    </main>
  );
}

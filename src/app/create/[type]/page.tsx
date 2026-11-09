import { notFound, redirect } from "next/navigation";
import { CreateForm } from "@/components/create/CreateForm";
import { requireMember } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";
import { CREATE_ROUTES, POST_TYPES, PRIVATE_ONLY_TYPES } from "@/lib/constants";
import { isUuid } from "@/lib/utils";

export default async function CreatePage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ chain_parent?: string; chain_answer?: string; prompt?: string; for?: string }> }) {
  const { type: route } = await params;
  const type = CREATE_ROUTES[route];
  if (!type) notFound();
  const { profile, settings } = await requireMember(`/create/${route}`);
  const sp = await searchParams;
  const supabase = await createClient();
  // The three private-wall templates need a private wall to hang on.
  const forPrivate = (PRIVATE_ONLY_TYPES as readonly string[]).includes(type) || (type === "picture" && sp.for === "private");
  if (forPrivate) {
    const { count } = await supabase.from("private_walls").select("owner_id", { count: "exact", head: true }).eq("owner_id", (await requireMember(`/create/${route}`)).user.id);
    if (!count) redirect("/private");
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
        forPrivate={forPrivate} type={type} label={POST_TYPES[type].label} prompts={prompts as { id: string; text: string }[]} isTeen={profile.age_group === "teen"}
        anonymousAllowed={settings.allow_anonymous_questions}
        chainParent={chainParent} chainAnswer={sp.chain_answer && isUuid(sp.chain_answer) ? sp.chain_answer : null} chainTitle={chainTitle}
        initialPrompt={sp.prompt && isUuid(sp.prompt) ? sp.prompt : null}
      />
    </main>
  );
}

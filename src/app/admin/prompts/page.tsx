import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data/session";
import { PromptRow } from "@/components/admin/AdminClient";

export default async function Prompts() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("random_prompts").select("id,text,active").order("created_at", { ascending: false });
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Random prompts</h1>
      <ul className="space-y-3"><PromptRow key="new" id={null} text="" active />{(data ?? []).map((p) => <PromptRow key={p.id} id={p.id} text={p.text} active={p.active} />)}</ul>
    </div>
  );
}

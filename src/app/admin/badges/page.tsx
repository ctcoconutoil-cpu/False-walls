import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data/session";
import { BadgeRow } from "@/components/admin/AdminClient";

export default async function Badges() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("badges").select("slug,name,description,rule,threshold,active").order("sort_order");
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Badges</h1>
      <p className="text-sm text-chalk-dim">Badges are earned from real activity rules only. There are no rules for message volume or repeated opening.</p>
      <ul className="space-y-3">{(data ?? []).map((b) => <BadgeRow key={b.slug} badge={b as never} />)}</ul>
    </div>
  );
}

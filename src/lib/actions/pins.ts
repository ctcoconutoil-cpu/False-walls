"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyError } from "@/lib/errors";
import type { ActionResult } from "@/lib/types";
import { isUuid } from "@/lib/utils";

async function run(fn: (s: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ error: { message: string } | null }>): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await fn(supabase);
  if (error) return { ok: false, error: friendlyError(error.message.includes("pins_full") ? "pins_full" : error) };
  revalidatePath("/profile", "layout");
  return { ok: true };
}
export async function pinPost(id: string): Promise<ActionResult> { return isUuid(id) ? run((s) => s.rpc("pin_post", { p_post: id })) : { ok: false, error: friendlyError("invalid_input") }; }
export async function unpinPost(id: string): Promise<ActionResult> { return isUuid(id) ? run((s) => s.rpc("unpin_post", { p_post: id })) : { ok: false, error: friendlyError("invalid_input") }; }
export async function movePin(id: string, dir: -1 | 1): Promise<ActionResult> { return isUuid(id) ? run((s) => s.rpc("move_pin", { p_post: id, p_dir: dir < 0 ? -1 : 1 })) : { ok: false, error: friendlyError("invalid_input") }; }

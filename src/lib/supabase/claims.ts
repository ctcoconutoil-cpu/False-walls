import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AuthUser = { id: string; email?: string };

/**
 * Who is signed in, read from the verified session token with no network round trip.
 * (auth.getUser() calls Supabase every time, which adds a full request to every page and every button.)
 * Database writes still check the token themselves, so this is only the fast "who is this" lookup.
 */
export async function getAuthUser(supabase: SupabaseClient): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getClaims();
  const c = data?.claims;
  return c?.sub ? { id: c.sub, email: typeof c.email === "string" ? c.email : undefined } : null;
}

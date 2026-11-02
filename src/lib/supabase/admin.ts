import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server only, and only used after a server-side staff check. */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}

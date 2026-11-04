import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

// Completes email links (confirm sign-up, reset password) and Google sign-in, then signs the person in.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), "/onboarding");
  const supabase = await createClient();
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=${next.startsWith("/reset") ? "reset" : "link"}`);
  }
  // A link opened in a different browser from the one that signed up can't be finished here. The email is
  // still confirmed in most cases, so tell the person to log in rather than leaving them guessing.
  const { data } = await supabase.auth.getUser();
  if (data.user) return NextResponse.redirect(`${origin}${next}`);
  return NextResponse.redirect(`${origin}/login?error=${next.startsWith("/reset") ? "reset" : "link"}`);
}

import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getViewer } from "@/lib/data/session";
import { safeNext } from "@/lib/utils";

export const metadata = { title: "Log in" };
const ERRORS: Record<string, string> = {
  link: "That link has expired, or it was opened in a different browser from the one you signed up in. If you already confirmed your email, log in below.",
  reset: "That reset link has expired. Request a new one with Forgot password.",
  google: "Google sign-in isn't available right now. Use your email instead.",
};
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const { user, profile } = await getViewer();
  if (user) redirect(profile ? safeNext(next) : "/onboarding");
  return <AuthForm mode="login" next={safeNext(next)} error={error ? ERRORS[error] : undefined} />;
}

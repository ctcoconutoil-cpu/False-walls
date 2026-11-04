import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getViewer } from "@/lib/data/session";
import { safeNext } from "@/lib/utils";

export const metadata = { title: "Create account" };
export default async function Signup({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { user, profile } = await getViewer();
  if (user) redirect(profile ? safeNext(next) : "/onboarding");
  return <AuthForm mode="signup" next={next ? safeNext(next) : undefined} />;
}

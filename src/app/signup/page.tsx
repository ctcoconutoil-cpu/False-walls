import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getViewer } from "@/lib/data/session";

export const metadata = { title: "Create account" };
export default async function Signup() {
  const { user, profile } = await getViewer();
  if (user) redirect(profile ? "/maze" : "/onboarding");
  return <AuthForm mode="signup" />;
}

import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { getViewer } from "@/lib/data/session";

export const metadata = { title: "Set up your profile" };
export default async function Onboarding() {
  const { user, profile } = await getViewer();
  if (!user) redirect("/login?next=/onboarding");
  if (profile) redirect("/maze");
  return <OnboardingForm />;
}

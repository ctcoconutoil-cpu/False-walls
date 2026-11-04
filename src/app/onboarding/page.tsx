import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { Notice } from "@/components/ui";
import { getViewer } from "@/lib/data/session";
import { safeNext } from "@/lib/utils";

export const metadata = { title: "Set up your profile" };
export default async function Onboarding({ searchParams }: { searchParams: Promise<{ confirmed?: string }> }) {
  const { confirmed } = await searchParams;
  const { user, profile } = await getViewer();
  if (!user) redirect("/login?next=/onboarding");
  if (profile) redirect(safeNext((await cookies()).get("fw_next")?.value));
  return (
    <>
      {confirmed && <div className="mx-auto max-w-sm px-5 pt-6"><Notice tone="ok">Email confirmed. You're signed in. Finish your profile to start exploring.</Notice></div>}
      <OnboardingForm />
    </>
  );
}

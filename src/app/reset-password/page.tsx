import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/PasswordForms";
import { getViewer } from "@/lib/data/session";

export const metadata = { title: "New password" };
export default async function Page() {
  const { user } = await getViewer();
  if (!user) redirect("/login?error=reset");
  return <ResetPasswordForm />;
}

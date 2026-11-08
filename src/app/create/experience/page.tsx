import { ExperienceForm } from "@/components/create/ExperienceForm";
import { requireMember } from "@/lib/data/session";

export const metadata = { title: "New experience" };

export default async function NewExperience() {
  const { profile } = await requireMember("/create/experience");
  if (profile.age_group === "teen") return <main className="mx-auto max-w-lg px-4 py-8"><p className="rounded-2xl bg-night-2 p-5">Experiences can only be posted by adult accounts. You can still browse them in Discover.</p></main>;
  return <main className="mx-auto max-w-lg px-4 py-6 pb-[calc(var(--dock)+1.5rem)]"><ExperienceForm /></main>;
}

import { notFound } from "next/navigation";
import { CardStack } from "@/components/private/CardStack";
import { getInbox } from "@/lib/data/private";
import { requireMember } from "@/lib/data/session";
import { isUuid } from "@/lib/utils";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default async function CardInbox({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  if (!isUuid(cardId)) notFound();
  await requireMember(`/private/${cardId}`);
  const inbox = await getInbox(cardId);
  if (!inbox) notFound();
  return <div data-nopad=""><CardStack card={inbox.card} slug={inbox.slug} messages={inbox.messages} /></div>;
}

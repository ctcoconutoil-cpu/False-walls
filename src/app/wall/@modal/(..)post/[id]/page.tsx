import { PostSheet } from "@/components/wall/PostSheet";
import { PostView } from "@/components/wall/PostView";

export default async function PostModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PostSheet><PostView id={id} modal /></PostSheet>;
}

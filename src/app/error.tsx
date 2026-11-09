"use client";
import { useRouter } from "next/navigation";
import { startTransition, useCallback } from "react";
import { Reconnect } from "@/components/ui/Reconnect";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const retry = useCallback(() => startTransition(() => { router.refresh(); reset(); }), [router, reset]);
  return <Reconnect retry={retry} />;
}

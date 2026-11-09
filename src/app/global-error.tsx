"use client";
import { useCallback } from "react";
import { Reconnect } from "@/components/ui/Reconnect";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const retry = useCallback(() => reset(), [reset]);
  return (
    <html lang="en"><body style={{ margin: 0, background: "#14112b" }}><Reconnect retry={retry} /></body></html>
  );
}

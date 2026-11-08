"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** Goes back to the screen you came from (a Discover scroll position, a profile, the Wall). Falls back to a fixed page for fresh links. */
export function BackLink({ fallback, className, children }: { fallback: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link href={fallback} className={className} onClick={(e) => {
      const fromHere = document.referrer && new URL(document.referrer).origin === location.origin;
      if (fromHere && window.history.length > 1) { e.preventDefault(); router.back(); }
    }}>{children}</Link>
  );
}

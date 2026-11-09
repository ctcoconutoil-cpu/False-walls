"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Registers the offline page and refreshes whatever is on screen the moment the network returns. */
export function OfflineSupport() {
  const router = useRouter();
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    const back = () => router.refresh();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [router]);
  return null;
}

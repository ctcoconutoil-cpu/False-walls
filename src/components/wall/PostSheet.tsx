"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/** A post opened from the Wall. It lies over the wall, which stays mounted beneath it so closing returns you to the same spot. */
export function PostSheet({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") router.back(); };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); prev?.focus?.(); };
  }, [router]);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Post" tabIndex={-1} className="wp-sheet fixed inset-0 z-[70] overflow-y-auto bg-night outline-none">
      <button type="button" onClick={() => router.back()} aria-label="Close post and return to the Wall" className="sticky top-0 z-10 ml-auto mr-3 mt-3 grid h-11 w-11 place-items-center rounded-full bg-night-2/90 text-xl font-black text-chalk shadow-lg backdrop-blur">✕</button>
      <div className="-mt-11">{children}</div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** There is no dead-end page: anything that doesn't exist sends you to the Wall. */
export default function NotFound() {
  const router = useRouter();
  useEffect(() => { router.replace("/wall"); }, [router]);
  return (
    <div role="status" className="grid min-h-dvh place-items-center bg-[#14112b] px-6 text-center text-[#f6efe4]">
      <div className="space-y-3">
        <div aria-hidden className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#30123f] border-t-[#F9A719]" />
        <p className="font-bold">Taking you to the Wall…</p>
        <Link href="/wall" className="text-sm underline">Go now</Link>
      </div>
    </div>
  );
}

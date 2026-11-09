"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Shown instead of an error page. Waits for the network and tries again on its own, so nobody has to refresh.
 * If the network is fine and the page still fails, it offers one button.
 */
export function Reconnect({ retry, title = "Getting your wall back" }: { retry: () => void; title?: string }) {
  const [online, setOnline] = useState(true);
  const tries = useRef(0);
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    setOnline(navigator.onLine);
    const go = () => { setOnline(true); tries.current = 0; setGaveUp(false); retry(); };
    const off = () => setOnline(false);
    window.addEventListener("online", go); window.addEventListener("offline", off);
    const t = setInterval(() => {
      if (!navigator.onLine) return;
      if (tries.current >= 4) { setGaveUp(true); return; }
      tries.current += 1; retry();
    }, 3000);
    return () => { window.removeEventListener("online", go); window.removeEventListener("offline", off); clearInterval(t); };
  }, [retry]);
  return (
    <div role="status" className="grid min-h-dvh place-items-center bg-[#14112b] px-6 text-center text-[#f6efe4]">
      <div className="max-w-xs space-y-4">
        <div aria-hidden className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#30123f] border-t-[#F9A719]" />
        <h1 className="text-2xl font-black">{online ? title : "You're offline"}</h1>
        <p className="text-sm opacity-80">{online ? (gaveUp ? "This is taking longer than it should." : "Hold on, we're loading it again.") : "This page will open by itself as soon as you're back online."}</p>
        {gaveUp && <button type="button" onClick={() => { tries.current = 0; setGaveUp(false); retry(); }} className="min-h-11 rounded-xl bg-[#F9A719] px-5 font-black text-[#2a1a05]">Try again</button>}
      </div>
    </div>
  );
}

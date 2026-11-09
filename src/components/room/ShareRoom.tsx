"use client";
import { useState } from "react";

export function ShareRoom({ username, name }: { username: string; name: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => {
      const url = `${location.origin}/@${username}`;
      try { if (navigator.share) await navigator.share({ title: name, url }); else { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2000); } } catch { /* cancelled */ }
    }} className="absolute left-3 top-3 min-h-11 rounded-full bg-black/55 px-4 text-sm font-black text-white">{done ? "Link copied" : "Share"}</button>
  );
}

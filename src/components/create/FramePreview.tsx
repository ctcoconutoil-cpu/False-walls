"use client";
import { useState } from "react";
import { WallCard } from "@/components/wall/WallCard";
import type { WallPost } from "@/lib/data/wall";

const NAMES = ["Cream frame", "Black frame with a white mat", "Gold frame"];

/** Shows the picture in the frame it will have on the public Wall. Rolling the dice tries another frame. */
export function FramePreview({ src, caption, frame, onFrame }: { src: string; caption: string; frame: number; onFrame: (f: number) => void }) {
  const [spin, setSpin] = useState(0);
  const roll = () => {
    onFrame((frame + 1 + Math.floor(Math.random() * 2)) % 3); // always a different frame
    setSpin((n) => n + 1);
  };
  const post = { id: "preview", type: "picture", title: caption || null, frame, wall_color: "slate", likes: 0, comments: 0, created_at: new Date().toISOString(), author: { username: "you", display_name: "You", avatar_style: "blob", avatar_color: "#F2573F", avatar_url: null }, media: [{ url: src, alt_text: "Your picture", storage_path: "", width: null, height: null }] } as unknown as WallPost;
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">How it will look on the Wall</p>
      <div className="mx-auto grid place-items-center rounded-2xl bg-night-2 p-5">
        <div className="relative h-[240px] w-[170px]"><WallCard post={post} p={{ variant: frame, seed: 0.3 }} /></div>
        <p className="mt-2 text-xs text-chalk-dim" aria-live="polite">{NAMES[frame]}</p>
      </div>
      <button type="button" onClick={roll} className="btn-press mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-night-3 font-extrabold">
        <span aria-hidden key={spin} className="inline-block text-xl" style={{ animation: spin ? "fw-dice .5s ease" : undefined }}>🎲</span> Roll the dice for a new frame
      </button>
      <input type="hidden" name="frame" value={frame} />
      <style>{"@keyframes fw-dice{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

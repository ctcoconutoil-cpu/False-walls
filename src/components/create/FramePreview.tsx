"use client";
import { useState, type CSSProperties } from "react";
import { WALL_COLORS, WALL_COLOR_CHOICES } from "@/lib/constants";
import type { WallColor } from "@/lib/types";

/** Shows the picture pinned on a wall in its frame. Rolling the dice tries another wall colour and tilt. */
export function FramePreview({ src, color, onColor }: { src: string; color: WallColor; onColor: (c: WallColor) => void }) {
  const [tilt, setTilt] = useState(-2);
  const [spin, setSpin] = useState(0);
  const c = WALL_COLORS[color] ?? WALL_COLORS.slate;
  const roll = () => {
    const next = WALL_COLOR_CHOICES[Math.floor(Math.random() * WALL_COLOR_CHOICES.length)];
    onColor(next);
    setTilt(Math.round((Math.random() * 8 - 4) * 10) / 10);
    setSpin((n) => n + 1);
  };
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">How it will look</p>
      <div className="bk-tile grid place-items-center rounded-2xl p-6" style={{ "--wall": c.dark, "--mortar": c.base } as CSSProperties}>
        <div className="relative z-10 w-40" style={{ transform: `rotate(${tilt}deg)`, transition: "transform .4s cubic-bezier(.3,1.5,.5,1)" }}>
          <i aria-hidden className="pw-pin" />
          <div className="paper rounded-[3px] bg-[#fbf9f2] p-1.5 pb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Your picture in its frame" className="aspect-[4/5] w-full rounded-[2px] object-cover" />
          </div>
        </div>
      </div>
      <button type="button" onClick={roll} className="btn-press mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-night-3 font-extrabold">
        <span aria-hidden key={spin} className="inline-block text-xl" style={{ animation: spin ? "fw-dice .5s ease" : undefined }}>🎲</span> Roll the dice for a new look
      </button>
      <style>{"@keyframes fw-dice{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

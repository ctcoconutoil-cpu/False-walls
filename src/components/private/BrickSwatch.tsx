import type { CSSProperties } from "react";
import { brickLook } from "@/lib/constants";

/** A small sample of a brick colour, drawn the same way as the real wall. */
export function BrickSwatch({ k, className = "h-20 rounded-lg" }: { k: string; className?: string }) {
  const look = brickLook(k);
  if (!look) return null;
  return <span aria-hidden className={`bk-tile block ${look.glow ? "bk-glow" : ""} ${className}`} style={{ "--wall": look.wall, "--mortar": look.mortar } as CSSProperties} />;
}

import type { ReactNode } from "react";
import type { WallIconKey } from "@/lib/constants";

const P: Record<WallIconKey, ReactNode> = {
  crown: <path d="M2.5 19h19l1-12-5.5 4.2L12 3.5 7 11.2 1.5 7zM3.5 20.5h17v1.8h-17z" />,
  flame: <path d="M12.5 1.8c.6 4.2 5.8 6.2 5.8 12.4A6.3 6.3 0 0 1 12 20.5a6.3 6.3 0 0 1-6.3-6.3c0-3 1.6-4.6 3-6.8.4 1.4 1 2.3 1.9 2.9.2-3.4.6-5.6 1.9-8.5zM12 20.5a3 3 0 0 1-3-3c0-2 1.7-2.8 3-4.8 1.3 2 3 2.8 3 4.8a3 3 0 0 1-3 3z" fillRule="evenodd" />,
  heart: <path d="M12 21.5S2.5 15.6 2.5 8.8A5.3 5.3 0 0 1 12 6a5.3 5.3 0 0 1 9.5 2.8c0 6.8-9.5 12.7-9.5 12.7z" />,
  eye: <path d="M12 5C6.5 5 2.4 8.7.8 12c1.6 3.3 5.7 7 11.2 7s9.6-3.7 11.2-7C21.6 8.7 17.5 5 12 5zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6.2a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z" fillRule="evenodd" />,
  ask: <><circle cx="12" cy="12" r="10.5" /><path d="M9 9.5a3 3 0 1 1 4.6 2.5c-1.1.7-1.6 1.2-1.6 2.5M12 17.2v.1" fill="none" stroke="var(--cut, #000)" strokeWidth="2.4" strokeLinecap="round" /></>,
  mega: <path d="M2.5 9.5v5a1 1 0 0 0 1 1H6l1.6 5.5h2.9L9 15.5h1.2L19.5 20V4l-9.3 4.5H3.5a1 1 0 0 0-1 1zM21 9v6a3 3 0 0 0 0-6z" />,
  star: <path d="m12 1.8 3 6.9 7.5.7-5.6 5 1.7 7.3L12 17.8l-6.6 3.9 1.7-7.3-5.6-5 7.5-.7z" />,
  music: <path d="M9 3.5 21 1.5v14.2a3.6 3.6 0 1 1-2-3.2V6L11 7.4v11.3a3.6 3.6 0 1 1-2-3.2z" />,
  plane: <path d="M1.5 12.8 22 3l-4.2 18-5.6-5.2-3.4 3.1-.4-5.6zm7.7 1.1.3 3.2 1.4-1.3 5.8-9.4z" fillRule="evenodd" />,
  camera: <path d="M8.5 3.5 7 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-1.5-2.5zM12 17.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z" fillRule="evenodd" />,
  ghost: <path d="M12 1.8a8 8 0 0 0-8 8v12l2.7-2.2 2.6 2.2 2.7-2.2 2.7 2.2 2.6-2.2L20 21.8v-12a8 8 0 0 0-8-8zM9 9.5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zm6 0a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2z" fillRule="evenodd" />,
  bolt: <path d="M13.5 1.5 3.5 14h7l-1.2 8.5L20.5 9.5h-7.3z" />,
  moon: <path d="M20.5 15A9 9 0 1 1 9 3.5a7.2 7.2 0 0 0 11.5 11.5z" />,
  book: <path d="M5 2.5h14a1.5 1.5 0 0 1 1.5 1.5v14.5H6.5a1.5 1.5 0 0 0 0 3h14v1.5H6a3 3 0 0 1-3-3V4.5a2 2 0 0 1 2-2zm1 2.5v10h.5z" />,
  coffee: <path d="M3 8h14v7a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5zm14 1.5h1.5a3 3 0 0 1 0 6H17v-1.8h1.5a1.2 1.2 0 0 0 0-2.4H17zM6 2.5c1 1 1 2 0 3M10 2.5c1 1 1 2 0 3M14 2.5c1 1 1 2 0 3" />,
  game: <path d="M7 6h10a5.5 5.5 0 0 1 5.4 6.4l-.7 4.4a2.8 2.8 0 0 1-5 1.2L15 16H9l-1.7 2a2.8 2.8 0 0 1-5-1.2l-.7-4.4A5.5 5.5 0 0 1 7 6zm.2 3v1.6H5.6v1.8h1.6V14H9v-1.6h1.6v-1.8H9V9zm8.6.8a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm2.4 2.4a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z" fillRule="evenodd" />,
  ball: <path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm0 3.4 4 2.8-1.5 4.8h-5L8 7.7zM4.6 9.6l2 1.4-.9 3.6-2.5-.6a8.4 8.4 0 0 1 1.4-4.4zm14.8 0a8.4 8.4 0 0 1 1.4 4.4l-2.5.6-.9-3.6zM9 17.5h6l1 2.3a8.4 8.4 0 0 1-8 0z" fillRule="evenodd" />,
  globe: <path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21zm-1 2.1v3.2L8.4 8 6.5 6.6A8.5 8.5 0 0 1 11 3.6zM3.8 11l3 .6 1.5 2.6-1.2 2.1-2.4-.6A8.4 8.4 0 0 1 3.8 11zm9.2 9.2v-2.5l2.2-1.9 2.6.3a8.5 8.5 0 0 1-4.8 4.1zM16 12l-2.3-1.2V8.4l3.1-1.3a8.5 8.5 0 0 1 2.3 3.6z" fillRule="evenodd" />,
  bulb: <path d="M12 1.8a7.2 7.2 0 0 0-4.2 13.1c.6.5 1 1.2 1 2V18h6.4v-1.1c0-.8.4-1.5 1-2A7.2 7.2 0 0 0 12 1.8zM9 19.5h6v1.6a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />,
  chat: <path d="M4 3h16a2.5 2.5 0 0 1 2.5 2.5v10A2.5 2.5 0 0 1 20 18h-8l-6 4.5V18H4a2.5 2.5 0 0 1-2.5-2.5v-10A2.5 2.5 0 0 1 4 3zm3 5v1.8h10V8zm0 3.8v1.8h6v-1.8z" fillRule="evenodd" />,
  rocket: <path d="M12 1.5c3.4 2 5.5 5.6 5.5 9.5l2.5 3.2V19l-4-1.4-1.7 2.9h-4.6l-1.7-2.9L4 19v-4.8L6.5 11c0-3.9 2.1-7.5 5.5-9.5zm0 6a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z" fillRule="evenodd" />,
  key: <path d="M8 3a6 6 0 0 1 5.7 7.8L22 19v3h-4v-2h-2v-2h-2.2l-2-2A6 6 0 1 1 8 3zm-1.5 3.2a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z" fillRule="evenodd" />,
};

/** The post icons. They draw in the current text colour so each board can tint its own. */
export function WallIcon({ name, size = 24, className, color }: { name: string; size?: number; className?: string; color?: string }) {
  const body = P[name as WallIconKey] ?? P.star;
  return <svg aria-hidden viewBox="0 0 24 24" width={size} height={size} fill={color ?? "currentColor"} className={className}>{body}</svg>;
}
export function isWallIcon(s: string | null | undefined): s is WallIconKey { return !!s && s in P; }

"use client";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx, avatarSrc } from "@/lib/utils";

export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "lg" ? "text-5xl sm:text-7xl" : size === "md" ? "text-3xl" : "text-xl";
  return (
    <span className={cx("display inline-flex flex-col leading-[0.9] uppercase", s)} aria-label="False Walls">
      <span className="text-chalk drop-shadow-[0_3px_0_rgba(0,0,0,.45)]">False</span>
      <span className="text-coral drop-shadow-[0_3px_0_rgba(0,0,0,.45)]">Walls</span>
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "coral" | "mustard" | "teal" | "violet" | "ghost" | "danger"; size?: "sm" | "md" | "lg" };
const TONES = {
  coral: "bg-coral text-[#2a0d08] [--btn-shadow:#8f2c1b] shadow-[0_5px_0_#8f2c1b]",
  mustard: "bg-mustard text-[#2c1e02] [--btn-shadow:#a87a14] shadow-[0_5px_0_#a87a14]",
  teal: "bg-teal text-[#04201c] [--btn-shadow:#0b6a60] shadow-[0_5px_0_#0b6a60]",
  violet: "bg-violet text-white [--btn-shadow:#4a2a9c] shadow-[0_5px_0_#4a2a9c]",
  danger: "bg-danger text-[#3a0808] [--btn-shadow:#a03030] shadow-[0_5px_0_#a03030]",
  ghost: "bg-night-3 text-chalk [--btn-shadow:#0d0b1f] shadow-[0_4px_0_#0d0b1f]",
};
const SIZES = { sm: "px-3 py-1.5 text-sm", md: "px-5 py-2.5 text-base", lg: "px-7 py-3.5 text-lg" };

export function Button({ tone = "coral", size = "md", className, ...p }: BtnProps) {
  return <button {...p} className={cx("btn-press display rounded-xl font-black disabled:opacity-50 disabled:pointer-events-none min-h-11", TONES[tone], SIZES[size], className)} />;
}
export function LinkButton({ href, tone = "coral", size = "md", className, children }: { href: string; tone?: BtnProps["tone"]; size?: BtnProps["size"]; className?: string; children: ReactNode }) {
  return <Link href={href} className={cx("btn-press display inline-flex items-center justify-center rounded-xl font-black min-h-11", TONES[tone ?? "coral"], SIZES[size ?? "md"], className)}>{children}</Link>;
}

export function Avatar({ user, size = 40, ring }: { user: { username: string; display_name?: string | null; avatar_style: string; avatar_color: string; avatar_url: string | null } | null; size?: number; ring?: string }) {
  if (!user) {
    return <span aria-hidden className="inline-grid place-items-center rounded-full bg-night-3 text-chalk-dim" style={{ width: size, height: size, fontSize: size * 0.45 }}>?</span>;
  }
  const src = avatarSrc(user.avatar_url);
  const label = user.display_name || user.username;
  return (
    <span className="inline-block shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size, outline: ring ? `3px solid ${ring}` : undefined }} role="img" aria-label={`${label}'s avatar`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <AvatarArt style={user.avatar_style} color={user.avatar_color} size={size} />
      )}
    </span>
  );
}

export function AvatarArt({ style, color, size }: { style: string; color: string; size: number }) {
  const ink = "#1b1530";
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <rect width="48" height="48" fill="#241f45" />
      {style === "brick" && <><rect x="8" y="12" width="32" height="24" rx="3" fill={color} /><path d="M8 24h32M20 12v12M30 24v12" stroke={ink} strokeWidth="2" opacity=".55" /></>}
      {style === "door" && <><path d="M12 40V20a12 12 0 0 1 24 0v20z" fill={color} /><circle cx="30" cy="30" r="2.2" fill={ink} /></>}
      {style === "star" && <path d="m24 7 4.9 10 11 1.6-8 7.7 1.9 11L24 32l-9.8 5.3 1.9-11-8-7.7 11-1.6z" fill={color} />}
      {style === "eye" && <><path d="M5 24c6-10 12-14 19-14s13 4 19 14c-6 10-12 14-19 14S11 34 5 24z" fill={color} /><circle cx="24" cy="24" r="7" fill={ink} /><circle cx="26.5" cy="21.5" r="2.2" fill="#fff" /></>}
      {style === "bolt" && <path d="M27 5 11 27h11l-3 16 18-24H26z" fill={color} />}
      {(style === "blob" || !["brick", "door", "star", "eye", "bolt"].includes(style)) && <><path d="M24 7c8 0 17 5 17 16s-6 18-17 18S7 34 7 24 16 7 24 7z" fill={color} /><circle cx="18" cy="21" r="2.4" fill={ink} /><circle cx="30" cy="21" r="2.4" fill={ink} /><path d="M18 30c3 3 9 3 12 0" stroke={ink} strokeWidth="2.4" strokeLinecap="round" fill="none" /></>}
    </svg>
  );
}

export function Sheet({ open, onClose, title, children, tone = "night" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; tone?: "night" | "plain" }) {
  const reduce = useReducedMotion();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest onClose in a ref. Callers pass a new function on every render; if it were an effect
  // dependency, each keystroke in a field inside the sheet would re-run the effect, pull focus out of the
  // field and dismiss the phone keyboard.
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex='-1'])");
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = o; prev?.focus(); };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.15 }}>
          <button aria-label="Close" className="absolute inset-0 bg-black/65" onClick={onClose} tabIndex={-1} />
          <motion.div
            ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
            initial={reduce ? false : { y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={reduce ? undefined : { y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className={cx("relative z-10 max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl safe-bottom", tone === "night" ? "bg-night-2 border-t-4 border-mustard" : "bg-chalk text-night")}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id={id} className="text-2xl">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-night-3 text-xl text-chalk">×</button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, hint, children, counter }: { label: string; hint?: string; children: ReactNode; counter?: string }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-3 text-sm font-semibold text-chalk">
        {label}
        {counter && <span className="text-xs font-normal text-chalk-dim">{counter}</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-chalk-dim">{hint}</span>}
    </label>
  );
}
export const inputCls = "w-full rounded-xl border-2 border-night-3 bg-night px-3.5 py-2.5 text-chalk placeholder:text-chalk-dim/70 focus:border-mustard focus:outline-none";

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "ok"; children: ReactNode }) {
  const c = tone === "error" ? "border-danger bg-danger/10 text-[#ffb4b4]" : tone === "ok" ? "border-teal bg-teal/10 text-[#9ff0e6]" : "border-sky bg-sky/10 text-[#bfe3ff]";
  return <p role={tone === "error" ? "alert" : "status"} className={cx("rounded-xl border-l-4 px-3.5 py-2.5 text-sm", c)}>{children}</p>;
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm rounded-2xl border-2 border-dashed border-night-3 p-8 text-center">
      <p className="display text-xl">{title}</p>
      {children && <p className="mt-2 text-sm text-chalk-dim">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SampleTag() {
  return <span className="rounded-md bg-night-3 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-chalk-dim">Sample</span>;
}

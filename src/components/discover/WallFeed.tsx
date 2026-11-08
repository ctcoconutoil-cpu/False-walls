"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FeedCard } from "@/components/discover/FeedCard";
import { loadDiscoverPage } from "@/lib/actions/wall";
import type { Post } from "@/lib/types";

type Saved = { posts: Post[]; page: number; hasMore: boolean; y: number };

/**
 * Discover's wall list as one long scroll. More posts load as you near the bottom. The loaded list and your scroll
 * position are remembered for the tab, so Back from a post lands you exactly where you were.
 */
export function WallFeed({ initial, hasMore: initialMore, filter, type }: { initial: Post[]; hasMore: boolean; filter: string; type: string | null }) {
  const key = `discover:${filter}:${type ?? "all"}`;
  const [posts, setPosts] = useState(initial);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(initialMore);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const restored = useRef(false);

  // Come back to a list that was already scrolled: put the same posts back, then the same position.
  useEffect(() => {
    if (restored.current) return; restored.current = true;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const s = JSON.parse(raw) as Saved;
      if (!s.posts?.length || s.posts[0]?.id !== initial[0]?.id) return;
      setPosts(s.posts); setPage(s.page); setMore(s.hasMore);
      requestAnimationFrame(() => window.scrollTo(0, s.y));
    } catch { /* storage unavailable */ }
  }, [key, initial]);

  const save = useCallback((y?: number) => {
    try { sessionStorage.setItem(key, JSON.stringify({ posts, page, hasMore: more, y: y ?? window.scrollY } satisfies Saved)); } catch { /* ignore */ }
  }, [key, posts, page, more]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => { clearTimeout(t); t = setTimeout(() => save(), 150); };
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("pagehide", onScroll as never);
    return () => { clearTimeout(t); window.removeEventListener("scroll", onScroll); window.removeEventListener("pagehide", onScroll as never); save(); };
  }, [save]);

  const next = useCallback(async () => {
    if (busy || !more) return;
    setBusy(true);
    try {
      const r = await loadDiscoverPage(filter, type, page + 1);
      setPosts((cur) => { const seen = new Set(cur.map((p) => p.id)); return [...cur, ...r.posts.filter((p) => !seen.has(p.id))]; });
      setPage((p) => p + 1); setMore(r.hasMore);
    } finally { setBusy(false); }
  }, [busy, more, filter, type, page]);

  useEffect(() => {
    const el = end.current; if (!el || !more) return;
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) next(); }, { rootMargin: "700px 0px" });
    io.observe(el); return () => io.disconnect();
  }, [more, next]);

  return (
    <>
      <ul className="space-y-3">{posts.map((p) => <li key={p.id}><FeedCard post={p} /></li>)}</ul>
      <div ref={end} aria-hidden className="h-1" />
      {busy && <p role="status" className="text-center text-sm text-chalk-dim">Loading more…</p>}
      {!more && posts.length > 0 && <p className="text-center text-sm text-chalk-dim">You&apos;ve reached the end. Everything here is also on the <a href="/wall" className="underline">Wall</a>.</p>}
    </>
  );
}

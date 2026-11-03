export default function Loading() {
  return (
    <div role="status" aria-label="Loading the Wall" className="grid h-[calc(100dvh-var(--dock))] place-items-center bg-[#0c0919]">
      <div className="text-center text-chalk-dim"><div aria-hidden className="fw-skel mx-auto mb-3 h-16 w-16 rounded-2xl" />Loading the Wall…</div>
    </div>
  );
}

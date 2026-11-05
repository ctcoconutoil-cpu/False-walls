export default function Loading() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-6" aria-busy="true" aria-label="Loading Adventure">
      <div className="fw-skel h-40 rounded-3xl" /><div className="fw-skel h-28 rounded-2xl" /><div className="fw-skel h-28 rounded-2xl" />
    </main>
  );
}

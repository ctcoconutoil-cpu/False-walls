/** Shown the moment you tap a link, while the next screen loads, so the app never feels frozen. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="mx-auto max-w-2xl space-y-4 px-4 pt-6">
      <div className="fw-skel h-8 w-1/2 rounded-xl" />
      <div className="fw-skel h-4 w-3/4 rounded-lg" />
      <div className="grid grid-cols-2 gap-3 pt-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="fw-skel h-36 rounded-2xl" />)}
      </div>
    </div>
  );
}

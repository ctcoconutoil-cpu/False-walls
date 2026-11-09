"use client";
import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/client-image";
import { ALLOWED_IMAGE_TYPES } from "@/lib/constants";

/** A file input that compresses images in the browser and shows previews. Files travel with the form. */
export function ImagePicker({ name, label, max = 1, maxDim = 1600, maxBytes, hint, onFiles, onPreviews }: { name: string; label: string; max?: number; maxDim?: number; maxBytes: number; hint?: string; onFiles?: (n: number) => void; onPreviews?: (urls: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const chosen = Array.from(e.target.files ?? []).slice(0, max);
    if (!chosen.length) { setPreviews([]); onFiles?.(0); onPreviews?.([]); return; }
    const bad = chosen.find((f) => !ALLOWED_IMAGE_TYPES.includes(f.type));
    if (bad) { setError("Use JPEG, PNG or WebP images."); e.target.value = ""; setPreviews([]); onFiles?.(0); return; }
    const out = await Promise.all(chosen.map((f) => compressImage(f, maxDim)));
    if (out.some((f) => f.size > maxBytes)) { setError(`Each picture must be under ${Math.round(maxBytes / 1048576)} MB.`); e.target.value = ""; setPreviews([]); onFiles?.(0); return; }
    const dt = new DataTransfer();
    out.forEach((f) => dt.items.add(f));
    if (input.current) input.current.files = dt.files;
    const urls = out.map((f) => URL.createObjectURL(f));
    setPreviews(urls); onPreviews?.(urls);
    onFiles?.(out.length);
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-semibold">{label}</label>
      <input ref={input} type="file" name={name} accept={ALLOWED_IMAGE_TYPES.join(",")} multiple={max > 1} onChange={onChange}
        className="block w-full rounded-xl border-2 border-dashed border-night-3 bg-night p-3 text-sm text-chalk-dim file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-mustard file:px-4 file:font-bold file:text-[#2c1e02]" />
      {hint && <p className="mt-1 text-xs text-chalk-dim">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-sm text-[#ffb4b4]">{error}</p>}
      {previews.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {previews.map((p) => (
            <li key={p}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p} alt="Selected upload preview" className="h-20 w-20 rounded-lg object-cover" /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

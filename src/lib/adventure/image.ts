/** Object illustrations: an uploaded picture when there is one, otherwise the emoji the object was created with. */
export function adventureImage(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/adventure/${path}` : null;
}

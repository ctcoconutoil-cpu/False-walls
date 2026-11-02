import "server-only";
import sharp from "sharp";
import { ALLOWED_IMAGE_TYPES, LIMITS } from "./constants";

export type ProcessedImage = { buffer: Buffer; width: number; height: number; bytes: number };

function sniff(buf: Buffer): string | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

/**
 * Validates an upload by content (not by filename or declared type), re-encodes it as WebP and strips
 * all metadata, including GPS location. Throws a short error code on failure.
 */
export async function processImage(file: File, kind: "post" | "avatar"): Promise<ProcessedImage> {
  const max = kind === "avatar" ? LIMITS.avatarBytes : LIMITS.imageBytes;
  if (file.size === 0) throw new Error("invalid_image");
  if (file.size > max * 1.2) throw new Error("image_too_large");
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error("invalid_image");
  const raw = Buffer.from(await file.arrayBuffer());
  if (!sniff(raw)) throw new Error("invalid_image");
  try {
    const pipeline = sharp(raw, { limitInputPixels: 40_000_000, failOn: "error" }).rotate();
    const resized = kind === "avatar"
      ? pipeline.resize(512, 512, { fit: "cover" })
      : pipeline.resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
    const { data, info } = await resized.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    if (data.length > max) throw new Error("image_too_large");
    return { buffer: data, width: info.width, height: info.height, bytes: data.length };
  } catch (e) {
    if (e instanceof Error && e.message === "image_too_large") throw e;
    throw new Error("invalid_image");
  }
}

/**
 * Optional external image moderation. Configure IMAGE_MODERATION_ENDPOINT and IMAGE_MODERATION_API_KEY
 * for a provider that accepts a POSTed image and answers { flagged: boolean }. Without them uploads are
 * accepted but remain subject to user reports and the moderation queue.
 */
export async function moderateImage(buffer: Buffer): Promise<"ok" | "flagged" | "unchecked"> {
  const endpoint = process.env.IMAGE_MODERATION_ENDPOINT;
  const key = process.env.IMAGE_MODERATION_API_KEY;
  if (!endpoint || !key) return "unchecked";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/webp" },
      body: new Uint8Array(buffer),
    });
    if (!res.ok) return "unchecked";
    const json = (await res.json()) as { flagged?: boolean };
    return json.flagged ? "flagged" : "ok";
  } catch {
    return "unchecked";
  }
}

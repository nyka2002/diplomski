// Copy source images into our public Storage bucket so listings survive the
// source removing/hotlink-blocking the originals. Each image is keyed by a hash
// of its source URL, so re-crawls reuse the same Storage path (idempotent).
import { createHash } from "node:crypto";
import { uploadImage } from "./supabase.mjs";

const EXT_BY_TYPE = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

function keyFor(listingId, sourceUrl) {
  const hash = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 16);
  return `${listingId}/${hash}`;
}

// Download one image and upload it to the bucket. Returns { url, storagePath,
// sourceUrl } or null on failure (a single bad image must not sink a listing).
async function copyOne(listingId, sourceUrl) {
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RealEstateThesisBot/1.0)" },
    });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    if (!contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0) return null;
    const ext = EXT_BY_TYPE[contentType] || "jpg";
    const storagePath = `${keyFor(listingId, sourceUrl)}.${ext}`;
    const url = await uploadImage(storagePath, bytes, contentType);
    return { url, storagePath, sourceUrl };
  } catch {
    return null;
  }
}

// Copy a listing's images sequentially (politeness). Returns the copied
// descriptors in source order; callers derive the images[] URL list and the
// listing_images rows from this.
export async function copyImages(listingId, sourceUrls, { limit = 8 } = {}) {
  const out = [];
  for (const src of sourceUrls.slice(0, limit)) {
    const copied = await copyOne(listingId, src);
    if (copied) out.push(copied);
  }
  return out;
}

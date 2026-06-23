// Best-effort embedding for a scraped listing (text-embedding-3-small). Returns
// the pgvector literal string `[v1,v2,…]` ready to store, or null when OpenAI
// isn't configured / the call fails — ingestion must not depend on it.
import { env } from "./env.mjs";
import { buildEmbeddingText } from "./normalize.mjs";

export async function embedListing(listing) {
  if (!env.openaiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: buildEmbeddingText(listing) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    return Array.isArray(vec) ? `[${vec.join(",")}]` : null;
  } catch {
    return null;
  }
}

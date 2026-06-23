// Reads + validates the environment the scrapers need. Load .env.local first:
//   set -a && . ./.env.local && set +a && node scrapers/run.mjs
export const env = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  openaiKey: process.env.OPENAI_API_KEY, // optional — embeddings are best-effort
  bucket: process.env.SCRAPE_IMAGE_BUCKET || "listing-images",
};

// Hard requirements (writes bypass RLS via the service role). OpenAI is optional.
export function requireEnv() {
  const missing = [];
  if (!env.url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    console.error(`Missing env: ${missing.join(", ")}. Load .env.local first.`);
    process.exit(1);
  }
  return env;
}

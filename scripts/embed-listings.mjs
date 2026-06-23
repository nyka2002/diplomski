// One-time (and re-runnable) backfill of listing embeddings for semantic search.
// Uses the Supabase REST API with the SERVICE ROLE key (to bypass RLS on write)
// and OpenAI text-embedding-3-small. No deps — plain fetch.
//
// Usage:
//   set -a && . ./.env.local && set +a && node scripts/embed-listings.mjs
//
// Requires in the environment: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// OPENAI_API_KEY. Pass --force to re-embed listings that already have one.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const force = process.argv.includes("--force");

if (!url || !serviceKey || !openaiKey) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY.",
  );
  process.exit(1);
}

const sb = (path, init = {}) =>
  fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

// Text we embed for each listing — the fields that carry meaning for search.
function listingText(l) {
  const specs = Array.isArray(l.specs) ? l.specs.map((s) => `${s.label}: ${s.value}`).join("; ") : "";
  const attrs = l.attributes || {};
  const flags = ["balcony", "parking", "furnished", "pets"].filter((k) => attrs[k]).join(", ");
  return [
    `${l.title} (${l.type === "sale" ? "for sale" : "for rent"})`,
    l.city,
    l.description,
    specs,
    flags && `Features: ${flags}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function embed(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

const onlyMissing = force ? "" : "&embedding=is.null";
const res = await sb(
  `listings?select=id,type,title,city,description,specs,attributes&order=id${onlyMissing}`,
);
if (!res.ok) {
  console.error("Failed to read listings:", res.status, await res.text());
  process.exit(1);
}
const listings = await res.json();
console.log(`${listings.length} listing(s) to embed${force ? " (forced)" : ""}.`);

let done = 0;
for (const l of listings) {
  try {
    const vec = await embed(listingText(l));
    const patch = await sb(`listings?id=eq.${encodeURIComponent(l.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ embedding: `[${vec.join(",")}]` }),
    });
    if (!patch.ok) throw new Error(`PATCH ${patch.status}: ${await patch.text()}`);
    done++;
    console.log(`  ✓ ${l.id} — ${l.title}`);
  } catch (e) {
    console.error(`  ✗ ${l.id} — ${e.message}`);
  }
}
console.log(`\nEmbedded ${done}/${listings.length}.`);
process.exit(done === listings.length ? 0 : 1);

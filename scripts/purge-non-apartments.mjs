// Remove scraped listings that aren't apartments. Two kinds of contamination
// slip into the apartment categories on the sources:
//   1. Promoted cross-category ads (cars, books, pets, …) whose detail URL is
//      NOT under the site's real-estate section.
//   2. Seller-miscategorized real estate (business premises, offices, land)
//      posted under "apartments" — caught by isApartmentTitle().
// Deletes cascade to saved_listings. Re-runnable and idempotent. Pass --dry-run
// to preview without deleting.
//
// Usage:
//   set -a && . ./.env.local && set +a && node scripts/purge-non-apartments.mjs [--dry-run]
import { requireEnv, env } from "../scrapers/lib/env.mjs";
import { isApartmentTitle } from "../scrapers/lib/normalize.mjs";

requireEnv();
const dryRun = process.argv.includes("--dry-run");

const sb = (path, init = {}) =>
  fetch(`${env.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

const res = await sb("listings?select=id,source,source_url,title_hr,title&source=neq.manual");
if (!res.ok) {
  console.error("Failed to read listings:", res.status, await res.text());
  process.exit(1);
}
const rows = await res.json();

const reason = (r) => {
  // njuškalo real-estate ads live under /nekretnine/; anything else is a
  // promoted cross-category ad. (Index only ever links to its /oglas/ ads.)
  if (r.source === "njuskalo" && !/njuskalo\.hr\/nekretnine\//.test(r.source_url || ""))
    return "not real estate";
  if (!isApartmentTitle(r.title_hr || r.title)) return "not an apartment";
  return null;
};

const doomed = rows.map((r) => ({ r, why: reason(r) })).filter((x) => x.why);
console.log(`${doomed.length}/${rows.length} listing(s) to delete${dryRun ? " (dry run)" : ""}:`);
for (const { r, why } of doomed) console.log(`   [${why}] ${r.title_hr || r.title}`);

if (dryRun || !doomed.length) process.exit(0);

let deleted = 0;
for (const { r } of doomed) {
  const del = await sb(`listings?id=eq.${encodeURIComponent(r.id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  if (del.ok) deleted += 1;
  else console.error(`  ✗ ${r.id}: ${del.status} ${await del.text()}`);
}
console.log(`\nDeleted ${deleted}/${doomed.length} listing(s).`);

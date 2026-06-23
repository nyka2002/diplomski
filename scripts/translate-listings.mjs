// Backfill English translations onto scraped listings — fast and re-runnable,
// with no re-crawl or image re-download. Croatian originals stay in the *_hr
// fields; English goes in title / description / spec label+value, and the
// embedding is refreshed from the English text. Best-effort: a row whose
// translation fails is left as-is and retried on the next run.
//
// Usage:
//   set -a && . ./.env.local && set +a && node scripts/translate-listings.mjs [--force]
//
// Without --force, only untranslated rows (title === title_hr) are processed.
import { requireEnv, env } from "../scrapers/lib/env.mjs";
import { translateListing } from "../scrapers/lib/translate.mjs";
import { embedListing } from "../scrapers/lib/embed.mjs";

requireEnv();
if (!env.openaiKey) {
  console.error("OPENAI_API_KEY is required for translation.");
  process.exit(1);
}
const force = process.argv.includes("--force");

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

const res = await sb(
  "listings?select=id,title,title_hr,description,description_hr,specs,city,attributes,type&source=neq.manual",
);
if (!res.ok) {
  console.error("Failed to read listings:", res.status, await res.text());
  process.exit(1);
}
const rows = await res.json();
const todo = force ? rows : rows.filter((r) => (r.title || "") === (r.title_hr || ""));
console.log(`${todo.length}/${rows.length} listing(s) to translate${force ? " (forced)" : ""}.`);

let done = 0;
for (const r of todo) {
  try {
    // Translate from the Croatian source of truth (the *_hr fields).
    const en = await translateListing({
      title: r.title_hr,
      description: r.description_hr,
      specs: r.specs || [],
    });
    if (!en) {
      console.error(`  ✗ ${r.id} — translation unavailable`);
      continue;
    }
    const specs = (r.specs || []).map((s, i) => ({
      label: en.specs?.[i]?.label || s.labelHr || s.label,
      labelHr: s.labelHr ?? s.label,
      value: en.specs?.[i]?.value || s.valueHr || s.value,
      valueHr: s.valueHr ?? s.value,
    }));
    const body = { title: en.title, description: en.description, specs };

    // Refresh the embedding from the English text (best-effort).
    const vec = await embedListing({
      title: en.title,
      city: r.city,
      description: en.description,
      type: r.type,
      attributes: r.attributes || {},
    });
    if (vec) body.embedding = vec;

    const patch = await sb(`listings?id=eq.${encodeURIComponent(r.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(body),
    });
    if (!patch.ok) throw new Error(`PATCH ${patch.status}: ${await patch.text()}`);
    done++;
    console.log(`  ✓ ${r.id} — ${en.title.slice(0, 60)}`);
  } catch (e) {
    console.error(`  ✗ ${r.id} — ${e.message}`);
  }
}
console.log(`\nTranslated ${done}/${todo.length}.`);
process.exit(done === todo.length ? 0 : 1);

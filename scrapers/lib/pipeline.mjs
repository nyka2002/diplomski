// Ingest orchestration: normalized listings → DB. Handles dedupe (skip
// unchanged rows by content_hash), image copy into Storage, embeddings, upsert,
// listing_images provenance, and status reconciliation (ads that vanished from
// the source are flipped to inactive).
import { select, upsert, patch, remove } from "./supabase.mjs";
import { copyImages } from "./images.mjs";
import { embedListing } from "./embed.mjs";
import { translateListing } from "./translate.mjs";

// Pull the existing (id → {content_hash, status}) map for a set of ids so we
// can decide insert vs update vs skip without a row-at-a-time round trip.
async function existingByIds(ids) {
  if (ids.length === 0) return new Map();
  const inList = ids.map((id) => `"${id}"`).join(",");
  const rows = await select(`listings?select=id,content_hash,status&id=in.(${inList})`);
  return new Map(rows.map((r) => [r.id, r]));
}

// Ingest one source's freshly-normalized listings.
// opts: { runStart (ISO), dryRun, withImages, withEmbeddings, withTranslate, force }
// Returns { found, inserted, updated, unchanged }.
export async function ingest(listings, opts = {}) {
  const {
    runStart,
    dryRun = false,
    withImages = true,
    withEmbeddings = true,
    withTranslate = true,
    force = false,
  } = opts;
  const existing = await existingByIds(listings.map((l) => l.id));
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  for (const listing of listings) {
    const prior = existing.get(listing.id);

    // Unchanged at the source → just refresh freshness (and revive if it had
    // been auto-deactivated). No re-copy, no re-embed. `force` re-processes
    // everything (e.g. to backfill new fields like translations / posted dates).
    if (!force && prior && prior.content_hash === listing.content_hash) {
      unchanged++;
      if (!dryRun) {
        await patch(`listings`, `id=eq.${encodeURIComponent(listing.id)}`, {
          last_seen_at: runStart,
          ...(prior.status === "inactive" ? { status: "active" } : {}),
        });
      }
      continue;
    }

    if (dryRun) {
      prior ? updated++ : inserted++;
      continue;
    }

    // Copy images off the source into our bucket; fall back to source URLs if
    // copying is disabled or yields nothing (keeps the gallery non-empty).
    let images = listing.images;
    let copied = [];
    if (withImages && listing.images.length) {
      copied = await copyImages(listing.id, listing.images);
      if (copied.length) images = copied.map((c) => c.url);
    }

    // Translate Croatian → English (best-effort). Croatian originals are kept in
    // the *_hr fields; English goes in the primary fields. Falls back to Croatian
    // in both when translation is off/unavailable.
    let en = null;
    if (withTranslate) en = await translateListing(listing);
    const title = en?.title || listing.title;
    const description = en?.description || listing.description;
    const specs = listing.specs.map((s, i) => ({
      label: en?.specs?.[i]?.label || s.labelHr || s.label,
      labelHr: s.labelHr ?? s.label,
      value: en?.specs?.[i]?.value || s.valueHr || s.value,
      valueHr: s.valueHr ?? s.value,
    }));

    // Embed the English text so it aligns with (mostly English) search queries.
    const embedding = withEmbeddings
      ? await embedListing({ ...listing, title, description, specs })
      : null;

    const row = {
      id: listing.id,
      external_id: listing.external_id,
      type: listing.type,
      title,
      title_hr: listing.title_hr,
      price_eur: listing.price_eur,
      price_display: listing.price_display,
      county: listing.county,
      city: listing.city,
      area_m2: listing.area_m2,
      rooms: listing.rooms,
      description,
      description_hr: listing.description_hr,
      images,
      specs,
      seller: listing.seller,
      attributes: listing.attributes,
      source: listing.source,
      source_url: listing.source_url,
      status: "active",
      content_hash: listing.content_hash,
      last_seen_at: runStart,
      ...(listing.posted_at ? { posted_at: listing.posted_at } : {}),
      ...(embedding ? { embedding } : {}),
    };

    await upsert("listings", row);

    // Refresh provenance rows for the copied images.
    if (copied.length) {
      await remove("listing_images", `listing_id=eq.${encodeURIComponent(listing.id)}`);
      await upsert(
        "listing_images",
        copied.map((c, i) => ({
          listing_id: listing.id,
          storage_path: c.storagePath,
          url: c.url,
          source_url: c.sourceUrl,
          position: i,
        })),
        "listing_id,position",
      );
    }

    prior ? updated++ : inserted++;
  }

  return { found: listings.length, inserted, updated, unchanged };
}

// Flip a source's listings that were NOT seen in this run to `inactive` (they
// disappeared from the source). Only safe after a full crawl — never call this
// for a `--limit`ed or `--dry-run` pass, or it would wrongly bury live ads.
export async function reconcileStatus(source, runStart) {
  if (!runStart) return 0;
  const stale = await select(
    `listings?select=id&source=eq.${encodeURIComponent(source)}&status=eq.active` +
      `&or=(last_seen_at.is.null,last_seen_at.lt.${runStart})`,
  );
  if (!stale.length) return 0;
  const ids = stale.map((r) => `"${r.id}"`).join(",");
  await patch("listings", `id=in.(${ids})`, { status: "inactive" });
  return stale.length;
}

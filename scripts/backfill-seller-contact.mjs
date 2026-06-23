// Backfill seller contact (email / phone) onto already-stored scraped listings
// by re-visiting each ad's source_url and reading the mailto:/tel: links from
// the static markup — no re-translate, no re-embed, no image re-download. The
// seller name/agency already on the row is preserved; only phone/email are
// merged in. Best-effort and re-runnable: rows whose page exposes no contact
// are left unchanged.
//
// (Njuškalo exposes the email as a mailto: link but gates the phone behind a
// "Prikaži broj" click, so typically only email fills in. Index.hr usually
// exposes neither.)
//
// Usage:
//   set -a && . ./.env.local && set +a && node scripts/backfill-seller-contact.mjs [--force] [--source=njuskalo]
//
// Without --force, only rows missing BOTH email and phone are visited.
import { chromium } from "playwright";
import { requireEnv, env } from "../scrapers/lib/env.mjs";
import { USER_AGENT, throttle } from "../scrapers/lib/polite.mjs";

requireEnv();
const force = process.argv.includes("--force");
const sourceArg = (process.argv.find((a) => a.startsWith("--source=")) || "").split("=")[1] || "";

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

let q = "listings?select=id,seller,source,source_url&source=neq.manual";
if (sourceArg) q += `&source=eq.${encodeURIComponent(sourceArg)}`;
const res = await sb(q);
if (!res.ok) {
  console.error("Failed to read listings:", res.status, await res.text());
  process.exit(1);
}
const rows = await res.json();

const has = (s, k) => Boolean(s && typeof s[k] === "string" && s[k].trim());
const todo = rows.filter(
  (r) => r.source_url && (force || (!has(r.seller, "email") && !has(r.seller, "phone"))),
);
console.log(`${todo.length}/${rows.length} listing(s) to visit${force ? " (forced)" : ""}.`);
if (!todo.length) process.exit(0);

// Pull mailto:/tel: out of the ad page. Scope to njuškalo's owner box when
// present so we don't pick up unrelated footer links; otherwise scan the page.
async function contactFor(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1500);
  const { email, phone } = await page.evaluate(() => {
    const box = document.querySelector(".ClassifiedDetailOwnerDetails") || document;
    const grab = (sel, pre) => {
      const href = box.querySelector(sel)?.getAttribute("href") || "";
      return href.replace(pre, "").trim();
    };
    return { email: grab("a[href^='mailto:']", /^mailto:/i), phone: grab("a[href^='tel:']", /^tel:/i) };
  });
  // Drop the classifieds platform's own support address (e.g. index.hr exposes
  // only "oglasi@index.hr") — it's not the seller's contact.
  return { email: /@(index\.hr|njuskalo\.hr)$/i.test(email) ? "" : email, phone };
}

const browser = await chromium.launch();
const context = await browser.newContext({ userAgent: USER_AGENT, locale: "hr-HR" });
const page = await context.newPage();

let updated = 0;
let i = 0;
for (const r of todo) {
  i += 1;
  try {
    const { email, phone } = await contactFor(page, r.source_url);
    if (!email && !phone) {
      console.log(`  [${i}/${todo.length}] ${r.id}: no contact exposed`);
      await throttle();
      continue;
    }
    const seller = { ...(r.seller || {}) };
    if (email && !has(seller, "email")) seller.email = email;
    if (phone && !has(seller, "phone")) seller.phone = phone;
    const patch = await sb(`listings?id=eq.${encodeURIComponent(r.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ seller }),
    });
    if (!patch.ok) {
      console.error(`  [${i}/${todo.length}] ${r.id}: PATCH ${patch.status} ${await patch.text()}`);
    } else {
      updated += 1;
      console.log(`  [${i}/${todo.length}] ${r.id}: ${email || "-"} | ${phone || "-"}`);
    }
  } catch (e) {
    console.error(`  [${i}/${todo.length}] ${r.id}: ${e.message}`);
  }
  await throttle();
}

await browser.close();
console.log(`\nUpdated ${updated}/${todo.length} listing(s).`);

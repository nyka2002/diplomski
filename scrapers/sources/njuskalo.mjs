// Njuškalo adapter — Croatia's largest classifieds site.
//
// NOTE ON SELECTORS: Njuškalo's markup changes over time and the site uses
// anti-bot protection, so the CSS selectors below are best-effort and the
// single point of maintenance for this source. Each field extraction is
// defensive (tries several selectors, tolerates misses) so a markup tweak
// degrades a field rather than crashing the run. Verify/adjust selectors with
// `node scrapers/run.mjs --source njuskalo --type sale --limit 1 --dry-run`.
import { USER_AGENT, throttle, robotsAllows } from "../lib/polite.mjs";
import { splitLocation, parsePostedAt } from "../lib/normalize.mjs";

const BASE = "https://www.njuskalo.hr";
const LIST_PATH = { sale: "/prodaja-stanova", rent: "/iznajmljivanje-stanova" };

// Pull the numeric ad id out of a Njuškalo detail URL (…-oglas-12345678).
function externalIdFromUrl(url) {
  const m = url.match(/oglas-(\d+)/) || url.match(/(\d{6,})/);
  return m ? m[1] : null;
}

// First textContent matching any of the candidate selectors, trimmed.
function pick(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const t = el && el.textContent ? el.textContent.trim() : "";
    if (t) return t;
  }
  return "";
}

async function collectDetailUrls(page, type, limit) {
  // Walk the paginated result list (?page=N) accumulating unique ad URLs until
  // we have `limit` of them or a page yields nothing new (end of results). The
  // page cap is a safety backstop against an unbounded loop.
  const found = new Set();
  const MAX_PAGES = 30;
  for (let pg = 1; found.size < limit && pg <= MAX_PAGES; pg++) {
    const url = pg === 1 ? `${BASE}${LIST_PATH[type]}` : `${BASE}${LIST_PATH[type]}?page=${pg}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    const links = await page.evaluate(() => {
      const sels = [".EntityList-item h3 a", "article a.link", ".entity-title a", "a.entity-title-link"];
      const set = new Set();
      for (const sel of sels)
        document.querySelectorAll(sel).forEach((a) => a.href && set.add(a.href));
      return [...set];
    });
    const before = found.size;
    // Only real-estate detail URLs (…/nekretnine/…) — the list pages also embed
    // promoted ads from unrelated categories (cars, books, pets, …) whose links
    // the broad selectors above would otherwise pick up.
    for (const u of links)
      if (/njuskalo\.hr\/nekretnine\//.test(u) && externalIdFromUrl(u)) found.add(u);
    if (found.size === before) break; // no new ads on this page → end of list
    if (pg < MAX_PAGES) await throttle();
  }
  return [...found].slice(0, limit);
}

async function scrapeDetail(page, url, type) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  const raw = await page.evaluate(() => {
    const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
    const pickIn = (selectors) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        const t = el && el.textContent ? clean(el.textContent) : "";
        if (t) return t;
      }
      return "";
    };

    // Njuškalo exposes facts as <dt>label</dt><dd>value</dd> pairs in two
    // blocks: the highlighted attributes (rooms, area) and the basic-details
    // list (location, floor, year, energy class, …). Collect them all into a
    // label→value map and a specs array for the detail table.
    const specs = [];
    const facts = {};
    document
      .querySelectorAll(
        ".ClassifiedDetailHighlightedAttributes dt, .ClassifiedDetailBasicDetails-list dt",
      )
      .forEach((dt) => {
        const dd = dt.nextElementSibling || dt.parentElement.querySelector("dd");
        const label = clean(dt.textContent);
        const value = clean(dd && dd.textContent);
        if (!label || !value) return;
        facts[label] = value;
        specs.push({ label, labelHr: label, value });
      });

    const images = [
      ...new Set(
        [...document.querySelectorAll(".ClassifiedDetailGallery img, .gallery img, img[itemprop='image']")]
          .map((img) => img.getAttribute("src") || img.getAttribute("data-src") || "")
          .filter((s) => s.startsWith("http")),
      ),
    ];

    // Posting date lives in a separate "system details" list ("Oglas objavljen").
    let postedRaw = "";
    document.querySelectorAll(".ClassifiedDetailSystemDetails dt").forEach((dt) => {
      if (/objavljen/i.test(dt.textContent || "")) {
        const dd = dt.nextElementSibling || dt.parentElement.querySelector("dd");
        if (dd) postedRaw = clean(dd.textContent);
      }
    });

    const areaKey = Object.keys(facts).find((k) => /povr[šs]in/i.test(k));
    return {
      title: pickIn(["h1", ".ClassifiedDetailSummary-title", "h1.title"]),
      priceText: pickIn([".ClassifiedDetailSummary-priceDomestic", ".price", "[class*='price']"]),
      city: facts["Lokacija"] || facts["Adresa"] || "",
      areaText: areaKey ? facts[areaKey] : "",
      roomsText: facts["Broj soba"] || "",
      description: pickIn([".ClassifiedDetailDescription-text", "[itemprop='description']"]),
      seller: (() => {
        // Best-effort contact: njuškalo usually gates the phone behind a
        // "Prikaži broj" click, but a mailto:/tel: link is sometimes present in
        // the static markup. Capture whatever is exposed without interacting.
        const box = document.querySelector(".ClassifiedDetailOwnerDetails") || document;
        const href = (sel) => box.querySelector(sel)?.getAttribute("href") || "";
        const email = href("a[href^='mailto:']").replace(/^mailto:/i, "").trim();
        return {
          name: pickIn([".ClassifiedDetailOwnerDetails-title", ".ClassifiedDetailOwnerDetails-name"]),
          // Ignore the platform's own support address (njuškalo's contact link),
          // which isn't the seller's.
          email: /@njuskalo\.hr$/i.test(email) ? "" : email,
          phone: href("a[href^='tel:']").replace(/^tel:/i, "").trim(),
        };
      })(),
      specs,
      postedRaw,
      images,
    };
  });

  const { county, city } = splitLocation(raw.city);
  return {
    externalId: externalIdFromUrl(url),
    type,
    categoryHint: type,
    title: raw.title,
    priceText: raw.priceText,
    county,
    city,
    areaText: raw.areaText,
    // Prefer the structured "Broj soba" fact; fall back to the title only if
    // the spec is missing (the title's "S4" code is unreliable).
    roomsText: raw.roomsText || raw.title,
    description: raw.description,
    specs: raw.specs,
    seller: raw.seller,
    images: raw.images,
    postedAt: parsePostedAt(raw.postedRaw),
    sourceUrl: url,
  };
}

export const njuskalo = {
  key: "njuskalo",
  baseUrl: BASE,
  async collect(browser, { type = "sale", limit = 20, log = () => {} } = {}) {
    if (!(await robotsAllows(BASE, LIST_PATH[type]))) {
      log(`robots.txt disallows ${LIST_PATH[type]} — skipping njuskalo/${type}`);
      return [];
    }
    const context = await browser.newContext({ userAgent: USER_AGENT, locale: "hr-HR" });
    const page = await context.newPage();
    try {
      const urls = await collectDetailUrls(page, type, limit);
      log(`njuskalo/${type}: ${urls.length} detail page(s)`);
      const out = [];
      for (const url of urls) {
        try {
          out.push(await scrapeDetail(page, url, type));
        } catch (e) {
          log(`  ✗ ${url}: ${e.message}`);
        }
        await throttle();
      }
      return out;
    } finally {
      await context.close();
    }
  },
};

// Oglasnik (Plavi oglasnik, oglasnik.hr) adapter — a third Croatian classifieds
// source, specialized broad classifieds with a large real-estate section.
//
// oglasnik.hr is a React app whose listing/detail pages hydrate client-side, so
// each page needs to settle before scraping (we wait for the hydrated content to
// appear). Like the Index adapter it deliberately anchors on STABLE signals
// rather than hashed CSS-module class names: the "…-oglas-<id>" detail URL, the
// concatenated "label+value" attribute rendering ("Površina74 m²"), the
// "Lokacija oglasa" block ("Hrvatska, Županija, Grad, Naselje"), the € price
// leaf, and the "Opis oglasa" description heading.
//
// robots.txt (User-agent: *) allows the browse categories used here
// (stanovi-prodaja / stanovi-najam) and disallows /search, /korisnik/, … which
// we do not touch. Re-validate selectors with
//   node scrapers/run.mjs --source oglasnik --type sale --limit 1 --dry-run
import { USER_AGENT, throttle, robotsAllows } from "../lib/polite.mjs";
import { splitLocation, parsePostedAt } from "../lib/normalize.mjs";

const BASE = "https://oglasnik.hr";
const LIST_PATH = { sale: "/stanovi-prodaja", rent: "/stanovi-najam" };

// Detail URLs look like /stanovi-prodaja/<slug>-oglas-<id>.
function externalIdFromUrl(url) {
  const m = url.match(/-oglas-(\d+)/) || url.match(/(\d{6,})/);
  return m ? m[1] : null;
}

async function collectDetailUrls(page, type, limit) {
  // Walk the paginated category (?page=N) accumulating unique ad URLs until we
  // have `limit` of them or a page yields nothing new (end of results). The page
  // cap is a safety backstop against an unbounded loop.
  const found = new Set();
  const MAX_PAGES = 30;
  for (let pg = 1; found.size < limit && pg <= MAX_PAGES; pg++) {
    const url = pg === 1 ? `${BASE}${LIST_PATH[type]}` : `${BASE}${LIST_PATH[type]}?page=${pg}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    // React list: wait until at least one detail link for this category hydrates.
    await page
      .waitForFunction(
        (p) => [...document.querySelectorAll("a[href]")].some((a) => new RegExp(`${p}/.*-oglas-\\d+`).test(a.href)),
        LIST_PATH[type],
        { timeout: 15000 },
      )
      .catch(() => {});
    const links = await page.evaluate(
      (p) => [
        ...new Set(
          [...document.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => new RegExp(`${p}/.*-oglas-\\d+`).test(h)),
        ),
      ],
      LIST_PATH[type],
    );
    const before = found.size;
    for (const u of links) if (externalIdFromUrl(u)) found.add(u);
    if (found.size === before) break; // no new ads on this page → end of list
    if (pg < MAX_PAGES) await throttle();
  }
  return [...found].slice(0, limit);
}

async function scrapeDetail(page, url, type) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  // The listing body hydrates client-side; wait for the € price to appear, then
  // scroll to trigger lazy-loaded gallery images.
  await page.waitForFunction(() => /€/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 1100);
    await page.waitForTimeout(500);
  }

  const raw = await page.evaluate(() => {
    const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
    const title = clean(document.querySelector("h1")?.textContent);

    // Attributes render as concatenated "label+value" ("Površina74 m²"), like
    // Index. Match each known field by its FULL label so a value can't swallow a
    // longer label's tail. Keep the first value seen per label.
    const facts = {};
    document.querySelectorAll("li,div,span,p,dd,dt").forEach((e) => {
      if (e.children.length > 2) return;
      const m = clean(e.textContent).match(
        /^(Broj soba|Stambena površina|Površina|Godina izgradnje|Energetski certifikat|Tip stana|Kat)\s*:?\s*(.+)$/i,
      );
      if (m && m[2].length < 40 && !facts[m[1]]) facts[m[1]] = m[2];
    });

    // Price: the leaf element showing the € amount (near the title).
    const priceText =
      [...document.querySelectorAll("*")]
        .filter((e) => e.children.length === 0 && /€/.test(e.textContent))
        .map((e) => clean(e.textContent))
        .find((t) => /\d/.test(t) && t.length < 30) || "";

    // Location: the "Lokacija oglasa" block renders as
    // "Hrvatska, Županija, Grad, Naselje" (+ an "Otvori u kartama" map link).
    let locRaw = "";
    const locH = [...document.querySelectorAll("*")].find(
      (e) => e.children.length === 0 && /^Lokacija oglasa$/i.test(clean(e.textContent)),
    );
    if (locH) {
      let n = locH.parentElement;
      for (let i = 0; i < 4 && n; i++) {
        const t = clean(n.textContent)
          .replace(/^Lokacija oglasa/i, "")
          .replace(/Otvori u kartama.*$/i, "")
          .trim();
        if (t.length > 3) {
          locRaw = t;
          break;
        }
        n = n.parentElement;
      }
    }

    // Description: the text under the "Opis oglasa" heading.
    let description = "";
    const dH = [...document.querySelectorAll("*")].find(
      (e) => e.children.length <= 1 && /^Opis oglasa$/i.test(clean(e.textContent)),
    );
    if (dH) {
      let n = dH.parentElement;
      for (let i = 0; i < 4 && n; i++) {
        const t = clean(n.textContent).replace(/^Opis oglasa/i, "").trim();
        if (t.length > 60) {
          description = t;
          break;
        }
        n = n.parentElement;
      }
    }

    // Gallery: listing photos live on the media CDN. Exclude the seller avatar
    // (/users/…) and the no-image placeholder. Best-effort — some ads have none.
    const images = [
      ...new Set(
        [...document.querySelectorAll("img,source")]
          .map((e) => e.currentSrc || e.getAttribute("src") || e.getAttribute("data-src") || "")
          .filter((s) => /media\.oglasnik\.hr\//.test(s) && !/\/users\//.test(s) && !/no-image/.test(s)),
      ),
    ];

    // Posting date: oglasnik shows the listing's "Aktivan od: DD.M.YYYY." line.
    // (Not "Korisnik od", which is the seller's account-registration date.)
    const bodyText = document.body.innerText;
    const postedRaw = (bodyText.match(/Aktivan od[:\s]*([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{2,4}\.?)/i) || [])[1] || "";

    const specs = Object.entries(facts).map(([label, value]) => ({ label, labelHr: label, value }));
    return { title, priceText, facts, locRaw, description, images, postedRaw, specs };
  });

  // Location arrives as "Hrvatska, Županija, Grad, Naselje" — drop the leading
  // country token, then reuse the shared county-first splitter (Zagreb grouping).
  // When the seller set no location, oglasnik renders a placeholder sentence
  // ("Korisnik nije označio lokaciju za ovaj oglas") — treat that as no location.
  const locClean = raw.locRaw.replace(/^Hrvatska\s*,\s*/i, "").trim();
  const hasLocation = locClean && !/korisnik nije označio lokaciju/i.test(locClean);
  const { county, city } = hasLocation ? splitLocation(locClean) : { county: "", city: "" };

  return {
    externalId: externalIdFromUrl(url),
    type,
    categoryHint: type,
    title: raw.title,
    priceText: raw.priceText,
    county,
    city,
    areaText: raw.facts["Stambena površina"] || raw.facts["Površina"] || "",
    // Prefer the structured "Broj soba" fact; fall back to the title.
    roomsText: raw.facts["Broj soba"] || raw.title,
    description: raw.description,
    specs: raw.specs,
    images: raw.images,
    postedAt: parsePostedAt(raw.postedRaw),
    sourceUrl: url,
  };
}

export const oglasnik = {
  key: "oglasnik",
  baseUrl: BASE,
  async collect(browser, { type = "sale", limit = 20, log = () => {} } = {}) {
    if (!(await robotsAllows(BASE, LIST_PATH[type]))) {
      log(`robots.txt disallows ${LIST_PATH[type]} — skipping oglasnik/${type}`);
      return [];
    }
    const context = await browser.newContext({ userAgent: USER_AGENT, locale: "hr-HR" });
    const page = await context.newPage();
    try {
      const urls = await collectDetailUrls(page, type, limit);
      log(`oglasnik/${type}: ${urls.length} detail page(s)`);
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

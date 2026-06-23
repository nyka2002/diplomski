// Index Oglasi (index.hr/oglasi) adapter — a second Croatian classifieds source.
//
// Calibrated against the live DOM (Nov 2025). The site is a JS-rendered SPA, so
// each page needs a short settle wait. It uses hashed CSS-module class names
// (unstable across deploys), so this adapter deliberately anchors on STABLE
// signals instead: og: meta tags (title/description/cover), the image CDN URL
// pattern, attribute label text ("Broj soba", "Stambena površina"), and the
// "Objavljen" date line. Re-validate with `--source index --limit 1 --dry-run`.
//
// Notes vs Njuškalo:
//   • Location: index doesn't expose a county, only "City, Neighborhood" (taken
//     from the listing's location line). County is left empty — the city/
//     neighborhood filters still work; the county filter just won't include these.
//   • Price: a listing can show an original + discounted price; we take the
//     current (lowest) asking price, ignoring the €/m² figure.
import { USER_AGENT, throttle, robotsAllows } from "../lib/polite.mjs";
import { parsePostedAt, parsePriceEur } from "../lib/normalize.mjs";

const BASE = "https://www.index.hr";
const LIST_PATH = { sale: "/oglasi/nekretnine/prodaja-stanova", rent: "/oglasi/nekretnine/najam-stanova" };

// Detail URLs look like /oglasi/nekretnine/<cat>/oglas/<slug>/<id>.
function externalIdFromUrl(url) {
  const m = url.match(/\/oglas\/[^/]+\/(\d+)\b/) || url.match(/(\d{5,})/);
  return m ? m[1] : null;
}

// Choose the listing's price from all "€" leaf texts on the page (which also
// include the €/m² figure and the neighbourhood price-comparison stats).
//   rent → the monthly figure ("€/mjesec" or "€/mj").
//   sale → the largest plain € amount: a property's asking price always dwarfs
//          the €/m² comparison stats, so the max is the price. (For a rare
//          original+discounted pair this is the pre-discount figure.)
function pickPrice(leaves, type) {
  if (type === "rent") {
    const monthly = leaves.find((t) => /\/\s*mj/i.test(t));
    if (monthly) return monthly;
  }
  const plain = leaves.filter((t) => !/\/\s*m/i.test(t)); // drop €/m² and €/mjesec
  const sorted = plain
    .map((t) => ({ t, n: parsePriceEur(t) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  return sorted[0]?.t || "";
}

async function collectDetailUrls(page, type, limit) {
  await page.goto(`${BASE}${LIST_PATH[type]}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000); // SPA: let the list render
  const links = await page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && /\/oglas\/[^/]+\/\d+$/.test(h)),
    ),
  ]);
  return links.map((h) => new URL(h, "https://www.index.hr").href).filter(externalIdFromUrl).slice(0, limit);
}

async function scrapeDetail(page, url, type) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);
  const raw = await page.evaluate(() => {
    const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
    const meta = (prop) => document.querySelector(`meta[property="${prop}"]`)?.getAttribute("content") || "";

    // Attributes by label text (robust to CSS-module hashing).
    const facts = {};
    document.querySelectorAll("li,div,span,p").forEach((e) => {
      if (e.children.length > 3) return;
      const m = clean(e.textContent).match(
        /^(Broj soba|Stambena površina|Kat|Godina izgradnje|Energetski razred|Tip stana|Broj etaža)\s*:?\s*(.+)$/i,
      );
      if (m && m[2].length < 30 && !facts[m[1]]) facts[m[1]] = m[2];
    });

    // All price-ish leaf texts (property prices, €/m², €/mjesec, comparison
    // stats). Type-specific selection happens in Node (pickPrice).
    const prices = [...document.querySelectorAll("[class*='cijena'],[class*='price'],[class*='Price']")]
      .filter((e) => e.children.length === 0)
      .map((e) => clean(e.textContent))
      .filter((t) => /€/.test(t));

    // Neighbourhood: index exposes it reliably only in the price-comparison
    // line ("…za naselje X"). It has no county and no clean city field.
    const naselje = (document.body.innerText.match(/za naselje\s+([^\n.<]{2,40})/i) || [])[1] || "";

    // Gallery: the image CDN URL pattern, scraped straight from the HTML.
    const html = document.documentElement.outerHTML;
    const gallery = [
      ...new Set(html.match(/https:\/\/www\.index\.hr\/oglasi\/api\/image\/direct\/[^"'\\)\s?]+\.jpg/gi) || []),
    ];

    // Description: the "Opis" section's container text.
    let description = "";
    const h = [...document.querySelectorAll("h1,h2,h3,h4,strong,span,div")].find(
      (e) => /^opis$/i.test(clean(e.textContent)),
    );
    if (h) {
      let n = h.parentElement;
      for (let i = 0; i < 4 && n; i++) {
        if (clean(n.textContent).length > 150) {
          description = clean(n.textContent).replace(/^opis\s*/i, "");
          break;
        }
        n = n.parentElement;
      }
    }

    const postedRaw =
      (document.body.innerText.match(
        /Objavljen[:\s]*([0-9]{1,2}\.[0-9]{1,2}\.[0-9]{2,4}\.?(?:\s*[0-9]{1,2}:[0-9]{2})?)/i,
      ) || [])[1] || "";

    return {
      ogTitle: meta("og:title"),
      ogDesc: meta("og:description"),
      description,
      prices,
      facts,
      gallery,
      postedRaw,
      naselje,
    };
  });

  const title = raw.ogTitle.replace(/\s*\|\s*INDEX OGLASI\s*$/i, "").trim();
  const priceText = pickPrice(raw.prices, type);
  // Location: index has no county/clean-city field — use the neighbourhood it
  // exposes ("…za naselje X") when present, else leave it blank.
  const city = raw.naselje;
  const description = raw.description || raw.ogDesc.split("\n").slice(1).join(" ").trim();
  const specs = Object.entries(raw.facts).map(([label, value]) => ({ label, labelHr: label, value }));

  return {
    externalId: externalIdFromUrl(url),
    type,
    categoryHint: type,
    title,
    priceText,
    county: "",
    city,
    areaText: raw.facts["Stambena površina"] || "",
    roomsText: raw.facts["Broj soba"] || "",
    description,
    specs,
    images: raw.gallery,
    postedAt: parsePostedAt(raw.postedRaw),
    sourceUrl: url,
  };
}

export const indexhr = {
  key: "index",
  baseUrl: BASE,
  async collect(browser, { type = "sale", limit = 20, log = () => {} } = {}) {
    if (!(await robotsAllows(BASE, LIST_PATH[type]))) {
      log(`robots.txt disallows ${LIST_PATH[type]} — skipping index/${type}`);
      return [];
    }
    const context = await browser.newContext({ userAgent: USER_AGENT, locale: "hr-HR" });
    const page = await context.newPage();
    try {
      const urls = await collectDetailUrls(page, type, limit);
      log(`index/${type}: ${urls.length} detail page(s)`);
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

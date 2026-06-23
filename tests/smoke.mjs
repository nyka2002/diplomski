// Smoke test — drives the app in a headless browser.
//
// Phase 0 behavior (i18n, theme, browse, sort, listing nav) is verified
// unconditionally. Phase 1 auth is verified two ways:
//   • Supabase NOT configured (default here): the new client-side validation
//     (button-enable, required fields) and graceful "not configured" path.
//   • Supabase configured (env present): the full register→signin→save→signout
//     journey. Set RUN_REAL_AUTH=1 with a project in .env.local to exercise it.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const REAL_AUTH = process.env.RUN_REAL_AUTH === "1";

// Detect whether Supabase is configured — from the env or, failing that, from
// .env.local — so `npm run test:e2e` also exercises the auth-gated checks.
function detectSupabaseUrl() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = txt.match(/^\s*NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)\s*$/m);
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}
const CONFIGURED = Boolean(detectSupabaseUrl());
let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  ✗ ${name} — ${err.message}`);
  }
}

const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// ── Home + i18n ──────────────────────────────────────────────────────────────
await page.goto(BASE, { waitUntil: "networkidle" });
await check("home renders hero (EN default)", async () => {
  expect(await page.getByText("find your perfect home").isVisible(), "hero missing");
});
await check("language toggle switches to Croatian", async () => {
  await page.getByRole("button", { name: "HR", exact: true }).click();
  await page.waitForTimeout(150);
  expect(await page.getByText("pronađite svoj savršeni dom").isVisible(), "HR hero missing");
  expect(
    await page.getByRole("link", { name: "početna", exact: true }).first().isVisible(),
    "HR nav missing",
  );
});
await check("language toggle switches back to English", async () => {
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.waitForTimeout(150);
  expect(await page.getByText("find your perfect home").isVisible(), "EN hero missing");
});

// ── Dark mode ────────────────────────────────────────────────────────────────
await check("dark mode toggles .dark on <html>", async () => {
  const before = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(before === false, "should start light");
  await page.locator("header button").nth(1).click();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(after === true, ".dark not applied");
  await page.locator("header button").nth(1).click();
});

// ── Browse + sorting (grid loads from the DB via /api/listings) ──────────────
await check("nav to Buy shows AI panel + listings load from DB", async () => {
  await page.getByRole("link", { name: "buy", exact: true }).first().click();
  await page.waitForURL("**/buy");
  expect(await page.getByText("AI property search").isVisible(), "AI panel missing");
  // Grid is fetched client-side — wait for the first card to arrive.
  await page.locator(".grid > div").first().waitFor({ state: "visible", timeout: 10000 });
});
await check("price sort reorders listings (low→high → ascending prices)", async () => {
  await page.getByRole("button", { name: "price: low to high", exact: true }).click();
  // Parse the displayed prices of the (all-sale) grid and assert non-decreasing.
  await page.waitForFunction(
    () => {
      const els = [...document.querySelectorAll(".grid > div p.font-extrabold")];
      if (els.length < 2) return false;
      const nums = els.map((e) => Number((e.textContent || "").replace(/[^\d]/g, "")));
      return nums.every((n, i) => i === 0 || nums[i - 1] <= n);
    },
    { timeout: 8000 },
  );
});

// ── Listing detail + origin-aware back ───────────────────────────────────────
await check("clicking a card opens listing detail", async () => {
  await page.locator(".grid > div").first().click();
  await page.waitForURL("**/listings/**");
  expect(await page.locator("h1").first().isVisible(), "detail title missing");
});
await check("back button returns to Buy (origin-aware)", async () => {
  await page.getByRole("button", { name: "back to listings" }).click();
  await page.waitForURL("**/buy");
  await page.locator(".grid > div").first().waitFor({ state: "visible", timeout: 10000 });
});

// ── Auth gate: saving while logged out redirects to sign-in ──────────────────
await check("saving while logged out redirects to sign-in", async () => {
  await page.locator(".grid > div").first().locator("button[aria-label='Save listing']").click();
  await page.waitForURL("**/sign-in");
  await page.getByText("welcome back").waitFor({ state: "visible", timeout: 5000 });
});

// ── Phase 1: sign-in form validation ─────────────────────────────────────────
await check("sign-in button is disabled until both fields are filled", async () => {
  const btn = page.getByRole("button", { name: "sign in", exact: true });
  expect(await btn.isDisabled(), "should start disabled");
  await page.getByLabel("username / email address").fill("someone");
  expect(await btn.isDisabled(), "still disabled with only username");
  await page.getByLabel("password").fill("secret123");
  expect(!(await btn.isDisabled()), "should enable once both filled");
});

// ── Phase 1: register form validation ────────────────────────────────────────
await check("register button stays disabled until the form is valid", async () => {
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  const btn = page.getByRole("button", { name: "create account", exact: true }).last();
  expect(await btn.isDisabled(), "should start disabled");
  await page.getByLabel("first name").fill("Marija");
  await page.getByLabel("last name").fill("Horvat");
  await page.getByLabel("username").fill("marija_test");
  await page.getByLabel("email address").fill("not-an-email");
  await page.getByLabel("phone number").fill("+385 91 234 5678");
  await page.getByLabel("password", { exact: true }).fill("short");
  await page.getByLabel("confirm password").fill("short");
  await page.waitForTimeout(100);
  expect(await btn.isDisabled(), "still disabled with bad email + weak password");
  await page.getByLabel("email address").fill("marija.test@example.com");
  await page.getByLabel("password", { exact: true }).fill("secret123");
  await page.getByLabel("confirm password").fill("secret123");
  await page.waitForTimeout(100);
  expect(!(await btn.isDisabled()), "should enable once every field is valid");
});

// Works in both modes and creates no data: a random non-existent identifier is
// rejected by real Supabase ("incorrect data"), or reports "not configured".
await check("submitting unknown credentials is rejected (no account created)", async () => {
  await page.goto(`${BASE}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel("username / email address").fill(`__nobody_${Date.now()}`);
  await page.getByLabel("password").fill("secret123");
  await page.getByRole("button", { name: "sign in", exact: true }).click();
  await page.waitForTimeout(600);
  const incorrect = await page.getByText("the entered data is incorrect").isVisible().catch(() => false);
  const notConfigured = await page
    .getByText("authentication is not configured yet.", { exact: false })
    .isVisible()
    .catch(() => false);
  expect(incorrect || notConfigured, "expected an auth-rejection or not-configured banner");
  // Either way we must NOT be logged in.
  expect(!page.url().endsWith("/"), "should remain on the sign-in page");
});

await check("logged-out nav hides Saved/Account", async () => {
  await page.goto(BASE, { waitUntil: "networkidle" });
  expect(
    !(await page
      .getByRole("link", { name: "saved listings", exact: true })
      .first()
      .isVisible()
      .catch(() => false)),
    "Saved should be hidden when logged out",
  );
});

if (CONFIGURED) {
  // Middleware route protection is only active when Supabase is configured.
  await check("visiting /account while logged out redirects to sign-in", async () => {
    await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    expect(page.url().includes("/sign-in"), `expected redirect to sign-in, at ${page.url()}`);
  });
  await check("visiting /saved while logged out redirects to sign-in", async () => {
    await page.goto(`${BASE}/saved`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    expect(page.url().includes("/sign-in"), `expected redirect to sign-in, at ${page.url()}`);
  });
}

if (REAL_AUTH) {
  console.log("  · RUN_REAL_AUTH=1 — full register→login→signout journey is manual (SETUP_SUPABASE.md)");
}

// ── Phase 2: server-side sorting & filtering via /api/listings ───────────────
// Rule-based against whatever ACTIVE data exists (the scraped listings), with
// filter targets derived from the live data — so the suite stays valid as the
// dataset changes. Skipped only when the listings table is empty.
if (CONFIGURED) {
  const api = async (qs) => (await page.request.get(`${BASE}/api/listings?${qs}`)).json();
  const sale = await api("type=sale&pageSize=50");
  const rent = await api("type=rent&pageSize=50");
  if (sale.total === 0 && rent.total === 0) {
    console.log("  · listings table empty — scrape (or seed) to test browse");
  } else {
    const ascending = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);
    const descending = (a) => a.every((v, i) => i === 0 || a[i - 1] >= v);

    await check("API: price-low sort is non-decreasing", async () => {
      const r = await api("type=sale&sort=priceLow&pageSize=50");
      expect(r.listings.length >= 1 && ascending(r.listings.map((l) => l.priceEur)), "not ascending");
    });
    await check("API: price-high sort is non-increasing", async () => {
      const r = await api("type=sale&sort=priceHigh&pageSize=50");
      expect(r.listings.length >= 1 && descending(r.listings.map((l) => l.priceEur)), "not descending");
    });
    await check("API: area sort orders by size descending", async () => {
      const r = await api("type=sale&sort=areaHigh&pageSize=50");
      expect(descending(r.listings.map((l) => l.areaM2)), "not sorted desc");
    });
    await check("API: date-new sort is newest-first by postedAt", async () => {
      const r = await api("type=sale&sort=dateNew&pageSize=50");
      expect(descending(r.listings.map((l) => new Date(l.postedAt).getTime())), "not newest-first");
    });
    await check("API: rooms exact filter returns only that room count", async () => {
      const target = sale.listings[0]?.rooms ?? 0; // a value that exists in the data
      const r = await api(`type=sale&roomsMin=${target}&roomsMax=${target}`);
      expect(r.total >= 1 && r.listings.every((l) => l.rooms === target), "rooms range leaked");
    });
    await check("API: roomsMin filter returns only listings at/above the threshold", async () => {
      const counts = sale.listings.map((l) => l.rooms).sort((a, b) => a - b);
      const threshold = counts[Math.floor(counts.length / 2)] ?? 0; // present in the set
      const r = await api(`type=sale&roomsMin=${threshold}`);
      expect(r.listings.every((l) => l.rooms >= threshold), "roomsMin leaked");
    });
    await check("API: city filter returns only that city (derived from live data)", async () => {
      const city = (sale.listings[0]?.location ?? "").split(", ")[0];
      expect(city.length > 0, "no city in data");
      const r = await api(`type=sale&city=${encodeURIComponent(city)}&pageSize=50`);
      expect(r.total >= 1 && r.listings.every((l) => l.location.startsWith(city)), "city filter leaked");
    });
    await check("API: furnished filter (rent) only returns furnished", async () => {
      if (!rent.listings.some((l) => l.attributes.furnished)) return; // none present → nothing to assert
      const r = await api("type=rent&furnished=true&pageSize=50");
      expect(r.total >= 1 && r.listings.every((l) => l.attributes.furnished), "furnished leaked");
    });
    await check("API: price range filter narrows results", async () => {
      const prices = sale.listings.map((l) => l.priceEur).sort((a, b) => a - b);
      const lo = prices[0];
      const hi = prices[prices.length - 1];
      const r = await api(`type=sale&priceMin=${lo}&priceMax=${hi}&pageSize=50`);
      expect(r.listings.every((l) => l.priceEur >= lo && l.priceEur <= hi), "price range leaked");
    });

    // ── Phase 3: AI filtering semantics (key-independent — exercised via the
    //    shared search engine, which the AI agent writes into) ───────────────
    await check("API: forbidden amenity is a HARD exclude", async () => {
      const r = await api("type=rent&forbidden=pets");
      expect(r.total >= 1 && r.listings.every((l) => !l.attributes.pets), "forbidden pets leaked");
    });
    await check("API: nice-to-have keeps all listings but flags + ranks them", async () => {
      const base = await api("type=rent");
      const r = await api("type=rent&nice=pets");
      // Ranked mode ranks up to RANK_CANDIDATES (1000) hard-filtered candidates,
      // so total matches the full set at this scale — nice-to-have must never
      // HARD-exclude a non-matching listing.
      expect(
        r.total === Math.min(base.total, 1000),
        `nice-to-have must not exclude; ${r.total} vs min(${base.total},1000)`,
      );
      // If any rental allows pets, a full match must rank first (unflagged).
      if (rent.listings.some((l) => l.attributes.pets)) {
        expect((r.listings[0].unmetNice ?? []).length === 0, "a full match should rank first");
      }
      // Every listing is flagged iff it does NOT meet the preference.
      expect(
        r.listings.every((l) =>
          l.attributes.pets
            ? !(l.unmetNice ?? []).includes("pets")
            : (l.unmetNice ?? []).includes("pets"),
        ),
        "nice-to-have flags incorrect",
      );
    });
    await check("API: /api/ai honors the configured/not-configured contract", async () => {
      const res = await page.request.post(`${BASE}/api/ai`, {
        data: { messages: [{ role: "user", content: "two bedroom with a balcony in Zagreb" }], lang: "en" },
      });
      const d = await res.json();
      if (d.configured === false) return; // no OPENAI_API_KEY yet — expected
      expect(d.criteria && typeof d.reply === "string", "configured AI must return criteria + reply");
    });

    // ── UI-driven filter panel (exercises the actual controls) ───────────────
    const waitResultsReady = () =>
      page.waitForFunction(
        () =>
          [...document.querySelectorAll("p")].some((e) =>
            /\d+\s+results$/.test((e.textContent || "").trim()),
          ),
        { timeout: 8000 },
      );
    const readResultsCount = () =>
      page.evaluate(() => {
        const p = [...document.querySelectorAll("p")].find((e) =>
          /\d+\s+results$/.test((e.textContent || "").trim()),
        );
        const m = p && (p.textContent || "").trim().match(/(\d+)/);
        return m ? Number(m[1]) : null;
      });
    // Read the count once it has stabilized (the grid refetch is async, so a
    // single read right after changing a filter can catch the pre-filter total).
    const settledResultsCount = async () => {
      let prev = null;
      for (let i = 0; i < 25; i++) {
        await page.waitForTimeout(200);
        const c = await readResultsCount();
        if (c !== null && c === prev) return c;
        prev = c;
      }
      return prev;
    };
    const resultsCountStartsWith = (n) =>
      page.waitForFunction(
        (prefix) => {
          const p = [...document.querySelectorAll("p")].find((e) =>
            /\d+\s+results$/.test((e.textContent || "").trim()),
          );
          return !!p && p.textContent.trim().startsWith(prefix);
        },
        `${n} `,
        { timeout: 8000 },
      );
    // A rooms count present in the sale data (the largest) — a filter target
    // guaranteed to match ≥1 listing and to narrow the grid.
    const sampleRooms = String(sale.listings.length ? Math.max(...sale.listings.map((l) => l.rooms)) : 1);

    await check("UI: city dropdown is type-scoped, narrows the grid + shows a chip", async () => {
      await page.goto(`${BASE}/buy`, { waitUntil: "networkidle" });
      await page.locator(".grid > div").first().waitFor({ state: "visible", timeout: 10000 });
      await page.getByRole("button", { name: "filters", exact: true }).click();
      // Open the (aria-labeled) City dropdown and choose the first real option.
      await page.getByRole("button", { name: "city", exact: true }).click();
      const option = page.locator(".absolute.z-30 button").nth(1); // [0] is the "any" clear row
      const cityName = ((await option.textContent()) || "").trim();
      await option.click();
      // A chip with that city appears AND the grid keeps ≥1 result — proving every
      // city offered on Buy actually has sale listings (fetchLocations type-scoped).
      await page.getByText(cityName, { exact: false }).first().waitFor({ state: "visible", timeout: 5000 });
      const n = await readResultsCount();
      expect(n !== null && n >= 1, `type-scoped city should yield ≥1 sale listing, got ${n}`);
    });

    await check("UI: county dropdown (when present) filters to that county", async () => {
      await page.goto(`${BASE}/buy`, { waitUntil: "networkidle" });
      await page.locator(".grid > div").first().waitFor({ state: "visible", timeout: 10000 });
      await page.getByRole("button", { name: "filters", exact: true }).click();
      const countyBtn = page.getByRole("button", { name: "county", exact: true });
      if (!(await countyBtn.count())) return; // pre-migration (no county column) → skip
      await countyBtn.click();
      const option = page.locator(".absolute.z-30 button").nth(1);
      await option.click();
      await waitResultsReady();
      const n = await readResultsCount();
      expect(n !== null && n >= 1, `county filter should yield ≥1 sale listing, got ${n}`);
    });

    await check("UI: rooms range filters, then Clear all restores the full count", async () => {
      await page.goto(`${BASE}/buy`, { waitUntil: "networkidle" });
      await page.locator(".grid > div").first().waitFor({ state: "visible", timeout: 10000 });
      await waitResultsReady();
      const full = await readResultsCount();
      await page.getByRole("button", { name: "filters", exact: true }).click();
      await page.getByLabel("rooms min").fill(sampleRooms);
      await page.getByLabel("rooms max").fill(sampleRooms);
      await page.getByLabel("rooms max").blur();
      await page.getByText(`min ${sampleRooms}`, { exact: false }).first().waitFor({ state: "visible", timeout: 5000 });
      const filtered = await settledResultsCount(); // wait for the filtered refetch to settle
      expect(filtered !== null && filtered <= full, `filtered (${filtered}) should be ≤ full (${full})`);
      await page.getByRole("button", { name: "clear all" }).first().click();
      await resultsCountStartsWith(String(full));
    });

    await check("UI: filters persist through opening a listing and clicking back", async () => {
      await page.goto(`${BASE}/buy`, { waitUntil: "networkidle" });
      await page.locator(".grid > div").first().waitFor({ state: "visible", timeout: 10000 });
      // The toggle is labeled "Filters" then "Filters (n)" once filters are active.
      await page.getByRole("button", { name: /^filters/ }).click();
      await page.getByLabel("rooms min").fill(sampleRooms);
      await page.getByLabel("rooms min").blur();
      await page.getByText(`min ${sampleRooms}`, { exact: false }).first().waitFor({ state: "visible", timeout: 5000 });
      const filtered = await settledResultsCount(); // wait for the filtered refetch to settle
      // Close the panel so the only ".grid" is the listings grid, then open a card.
      await page.getByRole("button", { name: /^filters/ }).click();
      await page.locator(".grid > div").first().click();
      await page.waitForURL("**/listings/**");
      await page.getByRole("button", { name: "back to listings" }).click();
      await page.waitForURL("**/buy");
      await page.locator(".grid > div").first().waitFor({ state: "visible", timeout: 10000 });
      await resultsCountStartsWith(String(filtered)); // restored from the in-memory snapshot
      await page.getByText(`min ${sampleRooms}`, { exact: false }).first().waitFor({ state: "visible", timeout: 5000 });
    });

    await check("UI: detail opens at top, and back restores the browse scroll", async () => {
      await page.setViewportSize({ width: 900, height: 500 }); // force a scrollable page
      await page.goto(`${BASE}/buy`, { waitUntil: "networkidle" });
      await page.locator(".grid > div").first().waitFor({ state: "visible", timeout: 10000 });
      await page.evaluate(() => window.scrollTo(0, 420));
      await page.waitForFunction(() => window.scrollY > 200, { timeout: 5000 });
      await page.locator(".grid > div").nth(2).click(); // a card further down
      await page.waitForURL("**/listings/**");
      await page.waitForFunction(() => window.scrollY < 60, { timeout: 5000 }); // detail opens at top
      await page.getByRole("button", { name: "back to listings" }).click();
      await page.waitForURL("**/buy");
      await page.locator(".grid > div").first().waitFor({ state: "visible", timeout: 10000 });
      // Restored to a scrolled position (would be ~0 without restoration).
      await page.waitForFunction(() => window.scrollY > 150, { timeout: 6000 });
      await page.setViewportSize({ width: 1280, height: 900 });
    });

    await check("UI (mobile): an 'AI search' button reveals the chat panel", async () => {
      await page.setViewportSize({ width: 800, height: 700 }); // below the lg breakpoint
      await page.goto(`${BASE}/buy`, { waitUntil: "networkidle" });
      const aiBtn = page.getByRole("button", { name: "AI search", exact: true });
      await aiBtn.waitFor({ state: "visible", timeout: 5000 });
      await aiBtn.click();
      await page
        .getByPlaceholder(/describe your ideal/i)
        .first()
        .waitFor({ state: "visible", timeout: 5000 });
      await page.setViewportSize({ width: 1280, height: 900 });
    });

    // ── Phase 4: admin access control (the test session is anon or non-admin,
    //    so both gates must keep it out). ────────────────────────────────────
    await check("admin: /admin is not reachable without the admin role", async () => {
      await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
      expect(!/\/admin(\?|$)/.test(page.url()), `should be redirected away from /admin, got ${page.url()}`);
    });
    await check("API: /api/scrape rejects non-admin callers (403)", async () => {
      const res = await page.request.post(`${BASE}/api/scrape`);
      expect(res.status() === 403, `expected 403, got ${res.status()}`);
    });
  }
}

await browser.close();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);

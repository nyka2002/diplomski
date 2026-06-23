// Politeness helpers: a descriptive UA, throttled navigation, and a best-effort
// robots.txt check. We crawl public listing pages slowly and identifiably — see
// SCRAPING.md for the compliance stance.
export const USER_AGENT =
  "Mozilla/5.0 (compatible; RealEstateThesisBot/1.0; academic project; +contact in repo)";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Random jitter around a base delay so requests don't look metronomic.
export async function throttle(baseMs = 2500) {
  await sleep(baseMs + Math.floor(Math.random() * 1500));
}

// Minimal robots.txt gate: fetch /robots.txt and refuse if a global `User-agent: *`
// block `Disallow`s the path prefix. Fails open (allows) if robots can't be read —
// the per-source adapter still rate-limits regardless.
export async function robotsAllows(baseUrl, path) {
  try {
    const res = await fetch(new URL("/robots.txt", baseUrl), { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return true;
    const txt = await res.text();
    const lines = txt.split("\n").map((l) => l.trim());
    let appliesToAll = false;
    const disallowed = [];
    for (const line of lines) {
      const [rawKey, ...rest] = line.split(":");
      const key = (rawKey || "").toLowerCase();
      const val = rest.join(":").trim();
      if (key === "user-agent") appliesToAll = val === "*";
      else if (key === "disallow" && appliesToAll && val) disallowed.push(val);
    }
    return !disallowed.some((d) => path.startsWith(d));
  } catch {
    return true;
  }
}

// Edge-safe per-IP rate limiting for the middleware. Plain fetch to the Supabase
// `rate_limit_hit` RPC (0008) — NO "server-only" / node APIs, so it runs in the
// Edge runtime. Fail-OPEN on any error (unconfigured, migration not applied, DB
// hiccup) so the app never breaks because of the limiter.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Best-effort client IP. Prefer the Vercel-managed `x-real-ip` (harder to forge
// than the leading entry of the client-controllable `x-forwarded-for` chain),
// falling back to XFF then a constant. Note: app-level IP limiting is inherently
// best-effort against a determined spoofer — the IP-independent daily LLM budget
// (0007) is the real spend ceiling.
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// Returns true if the call is allowed, false if the IP is over the bucket's cap.
export async function rateLimitHit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!SUPABASE_URL || !ANON_KEY) return true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rate_limit_hit`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_key: key, p_max: max, p_window_seconds: windowSeconds }),
    });
    if (!res.ok) return true;
    return (await res.json()) !== false;
  } catch {
    return true;
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { rateLimitHit, clientIp } from "@/lib/rate-limit";

// Per-IP request caps for the public API surface (the app has no login wall, so
// these bound random/bot abuse). Generous enough that a handful of demo testers
// never notice; tight enough to stop a script. The AI bucket is stricter because
// each call costs an OpenAI request (and 0007's daily budget is the spend ceiling).
const LIMITS = {
  ai: { max: 30, windowSeconds: 60 }, // /api/ai — LLM chat
  api: { max: 200, windowSeconds: 60 }, // everything else under /api
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const ip = clientIp(request.headers);
    const bucket = pathname.startsWith("/api/ai") ? "ai" : "api";
    const { max, windowSeconds } = LIMITS[bucket];
    const allowed = await rateLimitHit(`${ip}:${bucket}`, max, windowSeconds);
    if (!allowed) {
      return NextResponse.json(
        { error: "rateLimited" },
        { status: 429, headers: { "Retry-After": String(windowSeconds) } },
      );
    }
  }

  return updateSession(request);
}

export const config = {
  // Run on all routes except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

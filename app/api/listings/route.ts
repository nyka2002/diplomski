import { NextResponse, type NextRequest } from "next/server";
import { fetchListings } from "@/lib/listings/query";
import { parseListingQuery } from "@/lib/listings/params";

// Single source of truth for browse queries (sorting / filtering / pagination).
// Used by the Buy/Rent browse UI now and reused by the AI agent in Phase 3.
export async function GET(request: NextRequest) {
  const query = parseListingQuery(request.nextUrl.searchParams);
  const result = await fetchListings(query);
  return NextResponse.json(result);
}

// Thin Supabase REST + Storage client using the SERVICE ROLE key (bypasses RLS
// for ingest writes). No SDK dependency — plain fetch, matching the style of
// scripts/embed-listings.mjs.
import { env } from "./env.mjs";

const headers = (extra = {}) => ({
  apikey: env.serviceKey,
  Authorization: `Bearer ${env.serviceKey}`,
  "Content-Type": "application/json",
  ...extra,
});

const rest = (path, init = {}) =>
  fetch(`${env.url}/rest/v1/${path}`, { ...init, headers: headers(init.headers) });

// SELECT with a raw PostgREST query string, returns parsed rows.
export async function select(path) {
  const res = await rest(path);
  if (!res.ok) throw new Error(`select ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// Upsert rows on a conflict target (default: primary key `id`).
export async function upsert(table, rows, onConflict = "id") {
  const res = await rest(`${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(Array.isArray(rows) ? rows : [rows]),
  });
  if (!res.ok) throw new Error(`upsert ${table} → ${res.status}: ${await res.text()}`);
}

export async function patch(table, filter, body) {
  const res = await rest(`${table}?${filter}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`patch ${table} → ${res.status}: ${await res.text()}`);
}

export async function remove(table, filter) {
  const res = await rest(`${table}?${filter}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  if (!res.ok) throw new Error(`delete ${table} → ${res.status}: ${await res.text()}`);
}

export async function insertReturning(table, row) {
  const res = await rest(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`insert ${table} → ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data[0];
}

// ── Storage ─────────────────────────────────────────────────────────────────
// Upload bytes to the public bucket; returns the public URL. Upserts so a
// re-crawl of the same path is a no-op replace.
export async function uploadImage(path, bytes, contentType = "image/jpeg") {
  const res = await fetch(`${env.url}/storage/v1/object/${env.bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`upload ${path} → ${res.status}: ${await res.text()}`);
  return publicUrl(path);
}

export function publicUrl(path) {
  return `${env.url}/storage/v1/object/public/${env.bucket}/${path}`;
}

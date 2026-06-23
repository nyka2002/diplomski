"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import { GradientButton } from "@/components/common";
import ListingForm from "@/components/admin/ListingForm";
import {
  setUserActiveAction,
  setUserRoleAction,
  deleteListingAction,
} from "@/lib/admin/actions";
import type { AdminUser, AdminListing } from "@/lib/admin/data";

export default function AdminDashboard({
  adminId,
  users,
  listings,
}: {
  adminId: string;
  users: AdminUser[];
  listings: AdminListing[];
}) {
  const { lang } = useApp();
  const router = useRouter();
  const tr = translations[lang];
  const ta = tr.admin;

  const [tab, setTab] = useState<"users" | "listings">("users");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminListing | null>(null);
  const [scrapeMsg, setScrapeMsg] = useState("");

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3000);
  };

  const run = async (id: string, fn: () => Promise<{ ok: boolean; formError?: string }>) => {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.ok) {
      router.refresh();
    } else {
      flash(tr.authError[res.formError as keyof typeof tr.authError] ?? ta.genericError);
    }
  };

  const toggleActive = (u: AdminUser) =>
    run(`active:${u.id}`, () => setUserActiveAction(u.id, !u.isActive));
  const toggleRole = (u: AdminUser) =>
    run(`role:${u.id}`, () => setUserRoleAction(u.id, u.role === "admin" ? "user" : "admin"));

  const onDelete = (l: AdminListing) => {
    if (!window.confirm(ta.confirmDelete)) return;
    run(`del:${l.id}`, async () => {
      const res = await deleteListingAction(l.id);
      if (res.ok) flash(ta.deletedNotice);
      return res;
    });
  };

  const onScrape = async () => {
    setScrapeMsg("");
    setBusy("scrape");
    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const data = await res.json().catch(() => null);
      setScrapeMsg(data?.ok ? ta.scrapeQueued : ta.scrapeError);
    } catch {
      setScrapeMsg(ta.scrapeError);
    } finally {
      setBusy(null);
    }
  };

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (l: AdminListing) => {
    setEditing(l);
    setShowForm(true);
  };
  const onSaved = () => {
    setShowForm(false);
    flash(ta.savedNotice);
    router.refresh();
  };

  const dateFmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(lang === "hr" ? "hr-HR" : "en-GB");
    } catch {
      return iso.slice(0, 10);
    }
  };

  const statusBadge = (status: AdminListing["status"]) => {
    const label =
      status === "active" ? ta.statusActive : status === "inactive" ? ta.statusInactive : ta.statusRemoved;
    const cls =
      status === "active"
        ? "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/5"
        : "text-muted-foreground border-border bg-muted/40";
    return <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{ta.title}</h1>
          <p className="text-sm text-muted-foreground">{ta.subtitle}</p>
        </div>
        <button
          onClick={onScrape}
          disabled={busy === "scrape"}
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={busy === "scrape" ? "animate-spin" : ""} />
          {busy === "scrape" ? ta.scraping : ta.scrape}
        </button>
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400">
          {notice}
        </div>
      )}
      {scrapeMsg && (
        <div className="mb-4 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
          {scrapeMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        {(["users", "listings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
              tab === t
                ? "border-purple-500 text-purple-700 dark:text-purple-300"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "users" ? `${ta.tabUsers} (${users.length})` : `${ta.tabListings} (${listings.length})`}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{ta.name}</th>
                <th className="px-4 py-3">{ta.username}</th>
                <th className="px-4 py-3 hidden md:table-cell">{ta.email}</th>
                <th className="px-4 py-3">{ta.role}</th>
                <th className="px-4 py-3">{ta.status}</th>
                <th className="px-4 py-3 hidden lg:table-cell">{ta.joined}</th>
                <th className="px-4 py-3 text-right">{ta.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {ta.noUsers}
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const self = u.id === adminId;
                return (
                  <tr key={u.id} className="text-foreground">
                    <td className="px-4 py-3 font-semibold">
                      {`${u.firstName} ${u.lastName}`.trim() || "—"}
                      {self && (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                          {ta.you}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">@{u.username}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          u.role === "admin"
                            ? "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {u.role === "admin" ? ta.roleAdmin : ta.roleUser}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          u.isActive
                            ? "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/5"
                            : "text-destructive border-destructive/30 bg-destructive/5"
                        }`}
                      >
                        {u.isActive ? ta.active : ta.inactive}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">
                      {dateFmt(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => toggleRole(u)}
                          disabled={self || busy === `role:${u.id}`}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                        >
                          {u.role === "admin" ? ta.removeAdmin : ta.makeAdmin}
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={self || busy === `active:${u.id}`}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-40 ${
                            u.isActive
                              ? "border-destructive/30 text-destructive hover:bg-destructive/5"
                              : "border-green-500/30 text-green-600 dark:text-green-400 hover:bg-green-500/5"
                          }`}
                        >
                          {u.isActive ? ta.deactivate : ta.activate}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "listings" && (
        <>
          <div className="mb-4 flex justify-end">
            <GradientButton onClick={openNew} className="!py-2.5 px-4 flex items-center gap-2">
              <Plus size={15} />
              {ta.addListing}
            </GradientButton>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">{tr.listing.specs}</th>
                  <th className="px-4 py-3">{ta.type}</th>
                  <th className="px-4 py-3 hidden md:table-cell">{ta.city}</th>
                  <th className="px-4 py-3">{ta.price}</th>
                  <th className="px-4 py-3">{ta.status}</th>
                  <th className="px-4 py-3 text-right">{ta.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      {ta.noListings}
                    </td>
                  </tr>
                )}
                {listings.map((l) => (
                  <tr key={l.id} className="text-foreground">
                    <td className="px-4 py-3 font-semibold max-w-xs truncate">{l.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {l.type === "sale" ? ta.sale : ta.rent}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{l.location}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.price}</td>
                    <td className="px-4 py-3">{statusBadge(l.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(l)}
                          className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                        >
                          <Pencil size={12} />
                          {ta.edit}
                        </button>
                        <button
                          onClick={() => onDelete(l)}
                          disabled={busy === `del:${l.id}`}
                          className="flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                          {ta.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showForm && (
        <ListingForm
          lang={lang}
          listing={editing}
          onClose={() => setShowForm(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

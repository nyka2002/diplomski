"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SlidersHorizontal, X, ChevronDown, Sparkles, Search } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import type { Listing, ListingFilters, LocationGroup, SortOption } from "@/lib/listings/types";
import { SORT_OPTIONS, DEFAULT_SORT } from "@/lib/listings/types";
import { buildListingSearch, countActiveFilters } from "@/lib/listings/params";
import { criteriaToFilters } from "@/lib/ai/criteria";
import ListingCard from "@/components/ListingCard";
import AiChatPanel from "@/components/AiChatPanel";
import SelectDropdown from "@/components/SelectDropdown";

type ChatMessage = { role: "user" | "assistant"; content: string };

const AMENITIES = ["balcony", "parking", "furnished", "pets"] as const;

const inputCls =
  "w-full rounded-lg border border-border bg-input-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all";

// A dropdown that opens a panel of checkboxes for multi-select (neighborhoods),
// with a search box at the top to filter long lists.
function CheckboxDropdown({
  placeholder,
  searchPlaceholder,
  selectedLabel,
  options,
  selected,
  onToggle,
}: {
  placeholder: string;
  searchPlaceholder: string;
  selectedLabel: (n: number) => string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected.length ? "text-foreground" : "text-muted-foreground"}`}>
          {selected.length ? selectedLabel(selected.length) : placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg p-1">
          <div className="relative mb-1">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-border bg-input-background pl-8 pr-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700"
            />
          </div>
          <div className="max-h-56 overflow-auto">
            {visible.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                  className="w-4 h-4 rounded accent-purple-500"
                />
                {opt}
              </label>
            ))}
            {visible.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BrowseView({
  type,
  locations,
}: {
  type: "sale" | "rent";
  locations: LocationGroup[];
}) {
  const { lang, getBrowseSnapshot, setBrowseSnapshot, consumeScroll } = useApp();
  const tr = translations[lang];
  const pathname = usePathname();

  // Restore any browse state left from before navigating into a listing.
  const restored = useRef(getBrowseSnapshot(type)).current;
  const didRestoreScroll = useRef(false);

  const [sort, setSort] = useState<SortOption>(restored?.sort ?? DEFAULT_SORT);
  const [filters, setFilters] = useState<ListingFilters>(() => restored?.filters ?? {});
  const [panelOpen, setPanelOpen] = useState(false);

  const [listings, setListings] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Local text state for the numeric range inputs (committed on blur/Enter).
  const num = (v: number | undefined) => (v == null ? "" : String(v));
  const [ranges, setRanges] = useState(() => ({
    priceMin: num(restored?.filters.priceMin),
    priceMax: num(restored?.filters.priceMax),
    areaMin: num(restored?.filters.areaMin),
    areaMax: num(restored?.filters.areaMax),
    roomsMin: num(restored?.filters.roomsMin),
    roomsMax: num(restored?.filters.roomsMax),
  }));
  type RangeKey = keyof typeof ranges;

  // AI conversational search.
  const [aiQuery, setAiQuery] = useState("");
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiSessionId, setAiSessionId] = useState<string | undefined>(undefined);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiError, setAiError] = useState(false);
  const [aiOpen, setAiOpen] = useState(false); // mobile chat toggle

  // Measure a listing card so the AI panel can be exactly two rows tall on
  // desktop and one card tall on mobile.
  const gridRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(0);

  const filterKey = useMemo(() => buildListingSearch({ ...filters }), [filters]);

  const fetchPage = useCallback(
    async (p: number, replace: boolean) => {
      setLoading(true);
      const qs = buildListingSearch({ ...filters, type, sort, page: p });
      try {
        const res = await fetch(`/api/listings?${qs}`);
        const data = await res.json();
        setListings((prev) => (replace ? data.listings : [...prev, ...data.listings]));
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(data.page);
      } catch {
        if (replace) setListings([]);
      } finally {
        setLoading(false);
      }
    },
    [filters, sort, type],
  );

  // Refetch from page 1 whenever the type, sort, or filters change.
  useEffect(() => {
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, sort, filterKey]);

  // Keep the in-memory snapshot current so filters survive opening a listing and
  // returning to the browse page.
  useEffect(() => {
    setBrowseSnapshot(type, { filters, sort });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, filterKey, sort]);

  // Restore the exact browse scroll position captured when a listing was opened
  // (NOT the detail page's scroll). We return via router.push(scroll:false), so
  // the page initially keeps the detail offset; and the grid renders/grows
  // asynchronously, which can clamp a one-shot scrollTo. So re-apply the target
  // across animation frames until it sticks (or a short budget elapses). Runs
  // once per mount; if there's no captured position (e.g. a fresh visit) we
  // leave Next's default top-of-page behavior alone.
  useEffect(() => {
    if (didRestoreScroll.current) return;
    didRestoreScroll.current = true;
    const y = consumeScroll(pathname);
    if (!y) return;
    let frames = 0;
    const tick = () => {
      window.scrollTo(0, y);
      frames += 1;
      if (Math.abs(window.scrollY - y) > 2 && frames < 40) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track a listing card's height (re-measured on resize / results change).
  useEffect(() => {
    const measure = () => {
      const first = gridRef.current?.firstElementChild as HTMLElement | null;
      if (first) setCardH(first.offsetHeight);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [listings]);

  const GAP = 20; // tailwind gap-5

  const setFilter = <K extends keyof ListingFilters>(key: K, value: ListingFilters[K]) => {
    setFilters((f) => {
      const next = { ...f };
      const v: unknown = value;
      if (v === undefined || v === "" || v === false) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const commitRange = (key: RangeKey) => {
    const raw = ranges[key].trim();
    setFilter(key, raw === "" || Number.isNaN(Number(raw)) ? undefined : Number(raw));
  };

  // ── Location: county → city → neighborhoods cascade ─────────────────────────
  // Counties (top of the cascade), then the cities within the chosen county,
  // then the neighborhoods within the chosen city.
  const counties = useMemo(() => {
    const seen = new Set<string>();
    return locations
      .map((l) => l.county)
      .filter((c) => c && !seen.has(c) && seen.add(c));
  }, [locations]);

  const cityGroups = useMemo(
    () => locations.filter((l) => !filters.county || l.county === filters.county),
    [locations, filters.county],
  );
  const cityOptions = useMemo(() => {
    const seen = new Set<string>();
    return cityGroups.filter((l) => !seen.has(l.city) && seen.add(l.city));
  }, [cityGroups]);

  const selectedGroup = cityGroups.find((l) => l.city === filters.city);
  const neighborhoodOptions = selectedGroup?.neighborhoods ?? [];

  // Changing/clearing the county resets the city + neighborhoods under it.
  const setCounty = (county: string) => {
    setFilters((f) => {
      const next = { ...f };
      if (county) next.county = county;
      else delete next.county;
      delete next.city;
      delete next.neighborhoods;
      return next;
    });
  };

  const setCity = (city: string) => {
    setFilters((f) => {
      const next = { ...f };
      if (city) next.city = city;
      else delete next.city;
      delete next.neighborhoods; // changing/clearing the city resets neighborhoods
      return next;
    });
  };

  const toggleNeighborhood = (n: string) => {
    setFilters((f) => {
      const set = new Set(f.neighborhoods ?? []);
      if (set.has(n)) set.delete(n);
      else set.add(n);
      const arr = [...set];
      const next = { ...f };
      if (arr.length) next.neighborhoods = arr;
      else delete next.neighborhoods;
      return next;
    });
  };

  const clearCity = () =>
    setFilters((f) => {
      const next = { ...f };
      delete next.city;
      delete next.neighborhoods;
      return next;
    });

  const clearRange = (key: RangeKey) => {
    setRanges((r) => ({ ...r, [key]: "" }));
    setFilter(key, undefined);
  };

  const clearAll = () => {
    setFilters({});
    setRanges({ priceMin: "", priceMax: "", areaMin: "", areaMax: "", roomsMin: "", roomsMax: "" });
  };

  const activeCount = countActiveFilters(filters);

  // Build removable chips from the applied filters.
  const roomsWord = tr.filters.rooms.toLowerCase();
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.county) chips.push({ key: "county", label: filters.county, onRemove: () => setCounty("") });
  if (filters.city) chips.push({ key: "city", label: filters.city, onRemove: clearCity });
  for (const n of filters.neighborhoods ?? [])
    chips.push({ key: `n:${n}`, label: n, onRemove: () => toggleNeighborhood(n) });
  if (filters.priceMin != null)
    chips.push({
      key: "priceMin",
      label: `${tr.filters.min} €${filters.priceMin.toLocaleString()}`,
      onRemove: () => clearRange("priceMin"),
    });
  if (filters.priceMax != null)
    chips.push({
      key: "priceMax",
      label: `${tr.filters.max} €${filters.priceMax.toLocaleString()}`,
      onRemove: () => clearRange("priceMax"),
    });
  if (filters.areaMin != null)
    chips.push({
      key: "areaMin",
      label: `${tr.filters.min} ${filters.areaMin} m²`,
      onRemove: () => clearRange("areaMin"),
    });
  if (filters.areaMax != null)
    chips.push({
      key: "areaMax",
      label: `${tr.filters.max} ${filters.areaMax} m²`,
      onRemove: () => clearRange("areaMax"),
    });
  if (filters.roomsMin != null)
    chips.push({
      key: "roomsMin",
      label: `${tr.filters.min} ${filters.roomsMin} ${roomsWord}`,
      onRemove: () => clearRange("roomsMin"),
    });
  if (filters.roomsMax != null)
    chips.push({
      key: "roomsMax",
      label: `${tr.filters.max} ${filters.roomsMax} ${roomsWord}`,
      onRemove: () => clearRange("roomsMax"),
    });
  for (const a of AMENITIES)
    if (filters[a])
      chips.push({ key: a, label: tr.filters[a], onRemove: () => setFilter(a, undefined) });
  // AI overlay chips
  for (const a of filters.forbidden ?? [])
    chips.push({
      key: `forbid:${a}`,
      label: `${tr.filters.without}: ${tr.filters[a]}`,
      onRemove: () =>
        setFilters((f) => {
          const arr = (f.forbidden ?? []).filter((x) => x !== a);
          const next = { ...f };
          if (arr.length) next.forbidden = arr;
          else delete next.forbidden;
          return next;
        }),
    });
  for (const a of filters.niceToHave ?? [])
    chips.push({
      key: `nice:${a}`,
      label: `${tr.filters.prefer}: ${tr.filters[a]}`,
      onRemove: () =>
        setFilters((f) => {
          const arr = (f.niceToHave ?? []).filter((x) => x !== a);
          const next = { ...f };
          if (arr.length) next.niceToHave = arr;
          else delete next.niceToHave;
          return next;
        }),
    });
  if (filters.relevance)
    chips.push({
      key: "relevance",
      label: `“${filters.relevance}”`,
      onRemove: () => setFilter("relevance", undefined),
    });

  const handleAiSearch = async () => {
    const text = aiQuery.trim();
    if (!text || aiLoading) return;
    const history = [...aiMessages, { role: "user" as const, content: text }];
    setAiMessages(history);
    setAiQuery("");
    setAiError(false);
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, lang, sessionId: aiSessionId, type }),
      });
      const data = await res.json();
      if (data.configured === false) {
        setAiConfigured(false);
        return;
      }
      setAiConfigured(true);
      if (!res.ok || data.error || !data.criteria) {
        setAiError(true);
        return;
      }
      if (data.sessionId) setAiSessionId(data.sessionId);
      setAiMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      // The AI returns the COMPLETE current criteria; replace the shared filter
      // state so adds/removes across turns take effect (and chips/grid update).
      setFilters(criteriaToFilters(data.criteria));
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  const resetAi = () => {
    setAiMessages([]);
    setAiSessionId(undefined);
    setAiError(false);
    setAiQuery("");
    clearAll();
  };

  const aiChatProps = {
    t: tr.ai,
    messages: aiMessages,
    query: aiQuery,
    setQuery: setAiQuery,
    loading: aiLoading,
    configured: aiConfigured,
    error: aiError,
    onSearch: handleAiSearch,
    onReset: resetAi,
  };

  // A min/max number-input pair — shared by price, area, and rooms so they look
  // identical. Returns JSX (not a component) to avoid remounting on each render.
  const renderRange = (label: string, unit: string | undefined, minKey: RangeKey, maxKey: RangeKey) => (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
        {label}
        {unit ? ` (${unit})` : ""}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          placeholder={tr.filters.min}
          aria-label={`${label} ${tr.filters.min}`}
          value={ranges[minKey]}
          onChange={(e) => setRanges((r) => ({ ...r, [minKey]: e.target.value }))}
          onBlur={() => commitRange(minKey)}
          onKeyDown={(e) => e.key === "Enter" && commitRange(minKey)}
          className={inputCls}
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder={tr.filters.max}
          aria-label={`${label} ${tr.filters.max}`}
          value={ranges[maxKey]}
          onChange={(e) => setRanges((r) => ({ ...r, [maxKey]: e.target.value }))}
          onBlur={() => commitRange(maxKey)}
          onKeyDown={(e) => e.key === "Enter" && commitRange(maxKey)}
          className={inputCls}
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Sort + filter toggle bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <SlidersHorizontal size={15} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground font-semibold">{tr.sort.label}:</span>
        {SORT_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              sort === s
                ? "border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            style={sort === s ? { background: "rgba(123,111,196,0.12)" } : {}}
          >
            {tr.sort[s]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAiOpen((o) => !o)}
            className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-border text-foreground hover:bg-muted transition-colors"
          >
            <Sparkles size={13} />
            {tr.ai.open}
          </button>
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border text-foreground hover:bg-muted transition-colors"
          >
            {tr.filters.title}
            {activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>
      </div>

      {/* Mobile AI chat — one listing tall, toggled by the "AI search" button. */}
      {aiOpen && (
        <div className="lg:hidden mb-4" style={{ height: cardH || 360 }}>
          <AiChatPanel {...aiChatProps} />
        </div>
      )}

      {/* Filter panel */}
      {panelOpen && (
        <div className="mb-4 bg-card rounded-2xl border border-border p-5 space-y-4">
          {/* County → city → neighborhood */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {counties.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {tr.filters.county}
                </label>
                <SelectDropdown
                  value={filters.county ?? ""}
                  placeholder={tr.filters.any}
                  clearable
                  searchable
                  searchPlaceholder={tr.filters.search}
                  ariaLabel={tr.filters.county}
                  options={counties.map((c) => ({ value: c, label: c }))}
                  onChange={setCounty}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {tr.filters.city}
              </label>
              <SelectDropdown
                value={filters.city ?? ""}
                placeholder={tr.filters.any}
                clearable
                searchable
                searchPlaceholder={tr.filters.search}
                ariaLabel={tr.filters.city}
                options={cityOptions.map((l) => ({ value: l.city, label: l.city }))}
                onChange={setCity}
                className={inputCls}
              />
            </div>
            {filters.city && neighborhoodOptions.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  {tr.filters.neighborhood}
                </label>
                <CheckboxDropdown
                  placeholder={tr.filters.any}
                  searchPlaceholder={tr.filters.search}
                  selectedLabel={(n) => `${n} ${tr.filters.selected}`}
                  options={neighborhoodOptions}
                  selected={filters.neighborhoods ?? []}
                  onToggle={toggleNeighborhood}
                />
              </div>
            )}
          </div>

          {/* Ranges: price, area, rooms — identical min/max number inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {renderRange(tr.filters.price, "€", "priceMin", "priceMax")}
            {renderRange(tr.filters.area, "m²", "areaMin", "areaMax")}
            {renderRange(tr.filters.rooms, undefined, "roomsMin", "roomsMax")}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            {AMENITIES.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(filters[a])}
                  onChange={(e) => setFilter(a, e.target.checked || undefined)}
                  className="w-4 h-4 rounded accent-purple-500"
                />
                {tr.filters[a]}
              </label>
            ))}
            {activeCount > 0 && (
              <button
                onClick={clearAll}
                className="ml-auto text-xs font-semibold text-destructive hover:underline"
              >
                {tr.filters.clearAll}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
              style={{ background: "rgba(123,111,196,0.10)" }}
            >
              {chip.label}
              <X size={12} />
            </button>
          ))}
          <button
            onClick={clearAll}
            className="text-xs font-semibold text-destructive hover:underline ml-1"
          >
            {tr.filters.clearAll}
          </button>
        </div>
      )}

      {/* Results count — full width above both columns so the grid's first row
          and the AI panel's top start on the same line. */}
      <p className="text-xs text-muted-foreground mb-4">
        {loading && listings.length === 0 ? tr.filters.loading : `${total} ${tr.filters.results}`}
      </p>

      <div className="flex gap-6 items-start">
        {/* Grid */}
        <div className="flex-1 min-w-0">
          {!loading && listings.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">{tr.filters.noResults}</div>
          ) : (
            <div ref={gridRef} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => fetchPage(page + 1, false)}
                disabled={loading}
                className="px-8 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7B6FC4 0%, #C084A0 100%)" }}
              >
                {loading ? tr.filters.loading : tr.filters.loadMore}
              </button>
            </div>
          )}
        </div>

        {/* AI conversational search — desktop: exactly two listing-rows tall,
            aligned with the top of row 1 and the bottom of row 2. */}
        <aside
          className="hidden lg:block w-76 shrink-0"
          style={{ height: cardH ? cardH * 2 + GAP : undefined }}
        >
          <AiChatPanel {...aiChatProps} />
        </aside>
      </div>
    </div>
  );
}

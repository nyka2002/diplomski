"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export type SelectOption = { value: string; label: string };

// Shared single-select dropdown: a styled trigger button + chevron and a
// floating option panel (closes on outside click). Used by the browse filters
// (City) and the admin listing form (Type / Status) so every dropdown in the
// app shares one look. Pass `className` to match the surrounding inputs'
// radius/padding; `clearable` adds a placeholder option that resets to "".
const DEFAULT_TRIGGER =
  "w-full rounded-xl border border-border bg-input-background px-3.5 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all";

export default function SelectDropdown({
  value,
  options,
  onChange,
  placeholder,
  clearable = false,
  searchable = false,
  searchPlaceholder,
  className,
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  // Adds a filter input at the top of the panel — for long option lists
  // (counties, cities) where scrolling alone is tedious.
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  ariaLabel?: string;
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

  // Reset the filter whenever the panel closes; focus it when it opens.
  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
    else setQuery("");
  }, [open, searchable]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const selected = options.find((o) => o.value === value);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={`${className ?? DEFAULT_TRIGGER} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
          {selected ? selected.label : (placeholder ?? "")}
        </span>
        <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-card shadow-lg p-1">
          {searchable && (
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
                placeholder={searchPlaceholder ?? ""}
                className="w-full rounded-md border border-border bg-input-background pl-8 pr-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700"
              />
            </div>
          )}
          <div className="max-h-56 overflow-auto">
            {clearable && placeholder && !query && (
              <button
                type="button"
                onClick={() => choose("")}
                className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm text-muted-foreground"
              >
                {placeholder}
              </button>
            )}
            {visible.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => choose(opt.value)}
                className={`w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm ${
                  opt.value === value
                    ? "text-purple-700 dark:text-purple-300 font-semibold"
                    : "text-foreground"
                }`}
              >
                {opt.label}
              </button>
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

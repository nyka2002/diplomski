"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

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
  className,
  ariaLabel,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const selected = options.find((o) => o.value === value);

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
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-border bg-card shadow-lg p-1">
          {clearable && placeholder && (
            <button
              type="button"
              onClick={() => choose("")}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm text-muted-foreground"
            >
              {placeholder}
            </button>
          )}
          {options.map((opt) => (
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
        </div>
      )}
    </div>
  );
}

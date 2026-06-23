"use client";

import type { ReactNode } from "react";

export function InputField({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  onEnter,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  onEnter?: () => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-xl border bg-input-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 transition-all ${
          error
            ? "border-destructive focus:ring-red-300 dark:focus:ring-red-800"
            : "border-border focus:ring-purple-300 dark:focus:ring-purple-700"
        }`}
      />
      {error && <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function GradientButton({
  onClick,
  children,
  className = "",
  disabled = false,
  type = "button",
}: {
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 ${
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:opacity-90 active:scale-[0.98]"
      } ${className}`}
      style={{ background: "linear-gradient(135deg, #7B6FC4 0%, #C084A0 100%)" }}
    >
      {children}
    </button>
  );
}

"use client";

import { Heart } from "lucide-react";
import type { MouseEvent } from "react";

export default function HeartButton({
  saved,
  onToggle,
  size = "sm",
}: {
  saved: boolean;
  onToggle: (e: MouseEvent) => void;
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? "w-10 h-10" : "w-8 h-8";
  const iconSize = size === "lg" ? 20 : 16;
  return (
    <button
      onClick={onToggle}
      className={`${dim} flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95 ${
        saved ? "bg-pink-100 dark:bg-pink-900/30" : "bg-white/80 dark:bg-gray-800/80"
      } shadow-sm`}
      aria-label={saved ? "Remove from saved" : "Save listing"}
    >
      <Heart
        size={iconSize}
        className={saved ? "fill-pink-500 stroke-pink-500" : "fill-none stroke-pink-400"}
        strokeWidth={2}
      />
    </button>
  );
}

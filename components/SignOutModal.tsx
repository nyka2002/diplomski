"use client";

import { translations, type Lang } from "@/lib/i18n/translations";
import { GradientButton } from "@/components/common";

export default function SignOutModal({
  open,
  lang,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  lang: Lang;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const tr = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-card rounded-3xl p-8 shadow-2xl border border-border w-full max-w-sm">
        <h2 className="text-xl font-extrabold text-foreground mb-3">{tr.signout.title}</h2>
        <p className="text-muted-foreground mb-7 leading-relaxed">{tr.signout.message}</p>
        <div className="flex gap-3">
          <GradientButton onClick={onConfirm} className="flex-1">
            {tr.signout.yes}
          </GradientButton>
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors"
          >
            {tr.signout.no}
          </button>
        </div>
      </div>
    </div>
  );
}

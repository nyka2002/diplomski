"use client";

import { useEffect, useRef } from "react";
import { Search, Send } from "lucide-react";
import { translations } from "@/lib/i18n/translations";

type ChatMessage = { role: "user" | "assistant"; content: string };

// Self-contained AI chat. Fills its container's height (the parent sizes it:
// two listing-rows tall on desktop, one listing tall on mobile) and scrolls the
// conversation internally.
export default function AiChatPanel({
  t,
  messages,
  query,
  setQuery,
  loading,
  configured,
  error,
  onSearch,
  onReset,
}: {
  t: typeof translations.en.ai;
  messages: ChatMessage[];
  query: string;
  setQuery: (value: string) => void;
  loading: boolean;
  configured: boolean | null;
  error: boolean;
  onSearch: () => void;
  onReset: () => void;
}) {
  // Auto-scroll the conversation to the newest message / loading indicator.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  return (
    <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2.5 mb-3 shrink-0">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}
        >
          <Search size={14} className="text-white" />
        </div>
        <h3 className="font-bold text-foreground text-sm leading-tight flex-1">{t.title}</h3>
        {messages.length > 0 && (
          <button
            onClick={onReset}
            className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {t.reset}
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto space-y-2 mb-3 min-h-0">
        {messages.length === 0 && configured !== false && (
          <p className="text-xs text-muted-foreground leading-relaxed">{t.intro}</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-xs leading-relaxed rounded-xl px-3 py-2 ${
              m.role === "user" ? "bg-muted text-foreground ml-6" : "mr-6"
            }`}
            style={
              m.role === "assistant"
                ? { background: "rgba(123,111,196,0.08)", color: "var(--primary)" }
                : {}
            }
          >
            {m.content}
          </div>
        ))}
        {loading && <p className="text-xs text-muted-foreground">{t.searching}</p>}
        {error && <p className="text-xs text-destructive">{t.error}</p>}
        {configured === false && <p className="text-xs text-muted-foreground">{t.notConfigured}</p>}
      </div>

      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.placeholder}
        rows={4}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSearch();
          }
        }}
        className="w-full resize-none rounded-xl border border-border bg-input-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all mb-2 leading-relaxed shrink-0"
      />
      <button
        onClick={onSearch}
        disabled={loading || !query.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 shrink-0"
        style={{ background: "linear-gradient(135deg, #7B6FC4 0%, #C084A0 100%)" }}
      >
        <Send size={13} />
        {loading ? t.searching : t.send}
      </button>
    </div>
  );
}

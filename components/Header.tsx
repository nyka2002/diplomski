"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Globe, Moon, Sun, LogOut, Menu, X } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";

export default function Header() {
  const { lang, toggleLang, dark, toggleDark, isLoggedIn, requestSignOut, profile } = useApp();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tr = translations[lang];

  const navItems = [
    { href: "/", label: tr.nav.home },
    { href: "/buy", label: tr.nav.buy },
    { href: "/rent", label: tr.nav.rent },
    ...(isLoggedIn ? [{ href: "/saved", label: tr.nav.saved }] : []),
    ...(profile?.role === "admin" ? [{ href: "/admin", label: tr.nav.admin }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}
          >
            <Home size={16} className="text-white" />
          </div>
          <span className="font-extrabold text-lg text-foreground tracking-tight hidden sm:block">
            domovi
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navItems.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                pathname === href
                  ? "text-purple-700 dark:text-purple-300"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              style={pathname === href ? { background: "rgba(123,111,196,0.12)" } : {}}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleLang}
            title={lang === "en" ? "switch to croatian" : "prebaci na engleski"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Globe size={13} />
            {lang === "en" ? "HR" : "EN"}
          </button>
          <button
            onClick={toggleDark}
            aria-label={
              dark
                ? lang === "en"
                  ? "switch to light mode"
                  : "uključi svijetli način"
                : lang === "en"
                  ? "switch to dark mode"
                  : "uključi tamni način"
            }
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            {dark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {isLoggedIn ? (
            <>
              <Link
                href="/account"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}
                >
                  {(profile?.firstName?.[0] ?? "U").toUpperCase()}
                </div>
                {tr.nav.account}
              </Link>
              <button
                onClick={requestSignOut}
                className="hidden md:flex w-9 h-9 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                title={tr.account.signout}
              >
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden md:block px-4 py-1.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                {tr.nav.signin}
              </Link>
              <Link
                href="/register"
                className="hidden md:block px-4 py-1.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}
              >
                {tr.nav.register}
              </Link>
            </>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={
              mobileMenuOpen
                ? lang === "en"
                  ? "close menu"
                  : "zatvori izbornik"
                : lang === "en"
                  ? "open menu"
                  : "otvori izbornik"
            }
            aria-expanded={mobileMenuOpen}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            {mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-1">
          {[
            ...navItems,
            ...(isLoggedIn
              ? [{ href: "/account", label: tr.nav.account }]
              : [
                  { href: "/sign-in", label: tr.nav.signin },
                  { href: "/register", label: tr.nav.register },
                ]),
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {label}
            </Link>
          ))}
          {isLoggedIn && (
            <button
              onClick={() => {
                requestSignOut();
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {tr.account.signout}
            </button>
          )}
        </div>
      )}
    </header>
  );
}

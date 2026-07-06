"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/eventi", label: "Događaji" },
  { href: "/kalendar", label: "Kalendar" },
  { href: "/mapa", label: "Karta" },
];

export function SiteHeader({
  variant = "light",
}: {
  variant?: "light" | "ink";
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/eventi?q=${encodeURIComponent(query)}`);
  };

  const isInk = variant === "ink";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-md",
        isInk
          ? "border-white/10 bg-ink/80 text-ink-foreground"
          : "border-border bg-background/85 text-foreground",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:h-[72px] lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <img src="/logo/logo.svg" alt="Manifestacije" className="size-9 rounded-xl" />
          <span className="font-heading text-xl font-bold tracking-tight">
            Manifestacije
          </span>
        </Link>

        {/* Search */}
        <form
          onSubmit={onSearch}
          className={cn(
            "hidden flex-1 items-center gap-2 rounded-full border px-4 py-2 lg:flex",
            isInk ? "border-white/15 bg-white/5" : "border-border bg-muted/60",
          )}
        >
          <Search className="size-4 opacity-60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pretraži događaje, gradove, izvođače…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Pretraži događaje"
          />
        </form>

        {/* Nav links */}
        <nav className="hidden items-center gap-1 xl:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-3 py-2 text-sm font-medium transition-colors",
                isInk ? "hover:bg-white/10" : "hover:bg-muted",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <Link
          href="/dodaj-event"
          className="ml-auto hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 md:inline-flex"
        >
          <Plus className="size-4" />
          Dodaj event
        </Link>

        {/* Mobile menu toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            "ml-auto inline-flex size-10 items-center justify-center rounded-full md:hidden",
            isInk ? "hover:bg-white/10" : "hover:bg-muted",
          )}
          aria-label="Izbornik"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* Mobile panel */}
      {menuOpen && (
        <div className="border-t border-border bg-background px-4 py-4 text-foreground md:hidden">
          <form
            onSubmit={onSearch}
            className="mb-4 flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2.5"
          >
            <Search className="size-4 opacity-60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pretraži događaje…"
              className="w-full bg-transparent text-sm outline-none"
              aria-label="Pretraži događaje"
            />
          </form>
          <nav className="flex flex-col">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/dodaj-event"
            onClick={() => setMenuOpen(false)}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" />
            Dodaj event
          </Link>
        </div>
      )}
    </header>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <TriangleAlert className="size-12 text-muted-foreground" aria-hidden />
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">Nešto je pošlo po zlu</h1>
        <p className="text-muted-foreground">
          Došlo je do neočekivane greške pri učitavanju stranice. Pokušaj ponovno ili se vrati na početnu.
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Pokušaj ponovno
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Natrag na početnu
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

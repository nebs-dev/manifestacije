import type { Metadata } from "next";
import Link from "next/link";
import { CalendarSearch } from "lucide-react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";

export const metadata: Metadata = {
  title: "Stranica nije pronađena",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-24 text-center">
        <CalendarSearch className="size-12 text-muted-foreground" aria-hidden />
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">Stranica nije pronađena</h1>
        <p className="text-muted-foreground">
          Događanje ili stranica koju tražiš ne postoji, ili je uklonjena.
        </p>
        <Link
          href="/eventi"
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Pregledaj sva događanja
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}

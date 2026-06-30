import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { RegionGrid } from "@/components/public/region-grid";

export default function RegionsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-foreground">Regije</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold md:text-4xl">Istrazi Hrvatsku</h1>
        <p className="mb-8 mt-2 text-muted-foreground">Odaberi regiju i pronadi dogadanja.</p>
        <RegionGrid />
      </main>
      <SiteFooter />
    </>
  );
}

import Link from "next/link";
import { Taxonomy } from "../lib/api";

export function SearchFilters({ regions, categories }: { regions: Taxonomy[]; categories: Taxonomy[] }) {
  return (
    <form action="/" className="grid gap-3 rounded border bg-white p-4 md:grid-cols-4">
      <input name="search" placeholder="Pretraži događaje" />
      <select name="region"><option value="">Sve regije</option>{regions.map((r) => <option key={r.id} value={r.slug}>{r.name}</option>)}</select>
      <select name="category"><option value="">Sve kategorije</option>{categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
      <button type="submit">Filtriraj</button>
      <div className="flex flex-wrap gap-2 text-sm md:col-span-4">
        <Link href="/?free=true">Besplatno</Link>
        <Link href="/danas">Danas</Link>
        <Link href="/ovaj-vikend">Ovaj vikend</Link>
      </div>
    </form>
  );
}

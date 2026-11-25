import { BulkPosterUpload } from "@/components/admin/bulk-poster-upload"

export const metadata = { title: "Masovni unos plakata" }

export default function Page() {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Masovni unos plakata</h1>
        <p className="text-muted-foreground">
          Odaberite više plakata i pokrenite obradu jednim klikom. Svaki plakat obrađuje se zasebno i završava
          u popisu izvora na pregled — ništa se ne objavljuje bez vaše potvrde.
        </p>
      </header>
      <BulkPosterUpload />
    </div>
  )
}

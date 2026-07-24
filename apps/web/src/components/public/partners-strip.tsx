import type { PublicPartner } from "@/lib/public-api"
import { RandomSwapPartnerStrip } from "./random-swap-partner-strip"

export function PartnersStrip({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null

  return (
    <section className="border-t border-border bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-12 text-center font-heading text-2xl font-semibold md:text-3xl">Naši partneri</h2>
        <RandomSwapPartnerStrip partners={partners} />
      </div>
    </section>
  )
}

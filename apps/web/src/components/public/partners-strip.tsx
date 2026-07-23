import Image from "next/image"
import type { PublicPartner } from "@/lib/public-api"

export function PartnersStrip({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null

  return (
    <section className="border-t border-border bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-12 text-center font-heading text-2xl font-semibold md:text-3xl">Naši partneri</h2>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
          {partners.map((p) => (
            <a
              key={p.id}
              href={p.websiteUrl ?? undefined}
              target={p.websiteUrl ? "_blank" : undefined}
              rel={p.websiteUrl ? "noopener noreferrer" : undefined}
              className="flex items-center justify-center transition-opacity duration-200 hover:opacity-75"
            >
              <Image
                src={p.logoUrl}
                alt={p.name}
                width={200}
                height={80}
                className="h-16 w-auto object-contain md:h-20"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

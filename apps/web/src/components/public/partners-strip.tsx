import Image from "next/image"
import type { PublicPartner } from "@/lib/public-api"

export function PartnersStrip({ partners }: { partners: PublicPartner[] }) {
  if (partners.length === 0) return null

  const loop = [...partners, ...partners]

  return (
    <section className="border-t border-border bg-white py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Naši partneri</p>
        <div className="overflow-hidden">
          <div className="marquee-track flex w-max items-center gap-16">
            {loop.map((p, i) => (
              <a
                key={`${p.id}-${i}`}
                href={p.websiteUrl ?? undefined}
                target={p.websiteUrl ? "_blank" : undefined}
                rel={p.websiteUrl ? "noopener noreferrer" : undefined}
                className="shrink-0 transition-opacity hover:opacity-75"
              >
                <Image
                  src={p.logoUrl}
                  alt={p.name}
                  width={140}
                  height={48}
                  className="h-10 w-auto object-contain md:h-12"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

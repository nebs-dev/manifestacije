import type { CroEvent } from "@/lib/data"
import { cityLocationPhrase, cityName, regionLocationPhrase, regionName } from "@/lib/seo-taxonomy"
import type { PublicRegion } from "@/lib/public-api"

const canonicalBase = process.env.NEXT_PUBLIC_WEB_URL || "https://manifestacije.hr"

export type WeekendSeoScope =
  | { kind: "global" }
  | { kind: "city"; slug: string; events: CroEvent[] }
  | { kind: "region"; slug: string; regions?: PublicRegion[] }

export function kamoZaVikendSeo(scope: WeekendSeoScope) {
  if (scope.kind === "city") {
    const city = cityName(scope.slug, scope.events)
    const location = cityLocationPhrase(scope.slug, city)
    const canonical = `${canonicalBase}/kamo-za-vikend/gradovi/${scope.slug}`
    return {
      eyebrow: "Kamo za vikend",
      title: `Kamo za vikend ${city}? Događanja u ${location} | Manifestacije`,
      h1: `Kamo za vikend u ${location}?`,
      description: `Pregled aktualnih događanja ovaj vikend u ${location}: koncerti, festivali, predstave, radionice, obiteljski programi i besplatni eventi od petka do nedjelje.`,
      canonical,
      breadcrumbName: city,
    }
  }

  if (scope.kind === "region") {
    const region = regionName(scope.slug, scope.regions)
    const location = regionLocationPhrase(scope.slug, region)
    const canonical = `${canonicalBase}/kamo-za-vikend/regije/${scope.slug}`
    return {
      eyebrow: "Kamo za vikend",
      title: `Kamo za vikend ${region}? Događanja u ${location} | Manifestacije`,
      h1: `Kamo za vikend u ${location}?`,
      description: `Pregled aktualnih događanja ovaj vikend u ${location}: manifestacije, koncerti, festivali, izleti, radionice i programi od petka do nedjelje.`,
      canonical,
      breadcrumbName: region,
    }
  }

  return {
    eyebrow: "Kamo za vikend",
    title: "Kamo za vikend? Događanja od petka do nedjelje | Manifestacije",
    h1: "Kamo za vikend?",
    description: "Ne znaš kamo za vikend? Pogledaj aktualna događanja, koncerte, festivale, predstave, radionice i obiteljske programe od petka do nedjelje.",
    canonical: `${canonicalBase}/kamo-za-vikend`,
    breadcrumbName: "Kamo za vikend",
  }
}

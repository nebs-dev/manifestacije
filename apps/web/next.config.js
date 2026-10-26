// The map is client-only, so also surface missing configuration during builds.
if (!process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY?.trim()) {
  console.warn("[mapa] NEXT_PUBLIC_CARTO_BASEMAP_KEY is missing; CARTO tiles will be disabled. Set it before building the web app.");
}

// Long API region slugs -> the canonical short slug used in every public URL.
// Mirrors regionSlugAliases in src/lib/seo-taxonomy.ts; keep both in sync.
const REGION_SLUG_ALIASES = {
  "slavonija-i-baranja": "slavonija",
  "zagreb-i-okolica": "zagreb",
  "istra-i-kvarner": "istra",
  "sredisnja-hrvatska": "sredisnja",
  "lika-i-gorski-kotar": "lika",
  "medimurje-i-zagorje": "medimurje",
};

// Both slugs used to render 200 with their own canonical, so Search Console
// indexed each region twice (SEO-11). The short slug carries the traffic, so
// the long one redirects to it, including region/category and weekend subpaths.
// statusCode 301 rather than `permanent: true`, which emits 308: these are
// consolidating two indexed URLs, and 301 is the signal Search Console reports
// on without ambiguity.
const regionAliasRedirects = Object.entries(REGION_SLUG_ALIASES).flatMap(([alias, canonical]) => [
  { source: `/regije/${alias}`, destination: `/regije/${canonical}`, statusCode: 301 },
  { source: `/regije/${alias}/:path*`, destination: `/regije/${canonical}/:path*`, statusCode: 301 },
  { source: `/kamo-za-vikend/regije/${alias}`, destination: `/kamo-za-vikend/regije/${canonical}`, statusCode: 301 },
]);

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async headers() {
    return [{ source: "/reset-password", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
    ] }];
  },
  async redirects() {
    // Config-level redirect, not a page-level permanentRedirect() call — the
    // latter gets statically prerendered and served from CDN cache without a
    // Location header (Googlebot sees a bare 308 with an HTML body, flagged
    // as "Redirect error" in Search Console). Config redirects run in the
    // routing layer before static generation, so Location is always sent.
    return [
      // Compatibility redirects for literal URL requests, before rendering.
      // `/index` can also be an internal name for the `/` homepage; these
      // redirects do not eliminate CPU used to regenerate that homepage.
      { source: "/index", destination: "/", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/kamo-za-vikend", destination: "/ovaj-vikend", permanent: true },
      ...regionAliasRedirects,
    ];
  },
};
module.exports = nextConfig;

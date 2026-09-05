/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
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
    ];
  },
};
module.exports = nextConfig;

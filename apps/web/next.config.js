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
      { source: "/kamo-za-vikend", destination: "/ovaj-vikend", permanent: true },
    ];
  },
};
module.exports = nextConfig;

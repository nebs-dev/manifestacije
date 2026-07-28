const TRACKING_PARAMS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid", "ref"]);

function isTrackingParam(key: string): boolean {
  return key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase());
}

// Dedup key for DiscoveredSourceItem — resolves relative links against the
// page they were found on, strips whatever varies across visits (fragment,
// tracking params, trailing slash, default port) without touching anything
// that changes the actual resource (path, meaningful query params).
export function normalizeUrl(rawUrl: string, baseUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim(), baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }
  url.hash = "";

  const params = [...url.searchParams.entries()].filter(([key]) => !isTrackingParam(key));
  url.search = "";
  for (const [key, value] of params) url.searchParams.append(key, value);

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

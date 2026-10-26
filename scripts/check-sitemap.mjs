#!/usr/bin/env node
/**
 * Sitemap hygiene check (SEO-12): every URL listed in sitemap.xml must answer
 * 200, must not be noindex, and must carry a canonical pointing at itself.
 *
 * Usage:
 *   node scripts/check-sitemap.mjs [baseUrl]   # default https://manifestacije.hr
 *
 * Exits 1 when any URL violates one of the three rules.
 */

const base = (process.argv[2] || process.env.WEB_URL || "https://manifestacije.hr").replace(/\/$/, "")
const CONCURRENCY = 8

async function sitemapUrls() {
  const res = await fetch(`${base}/sitemap.xml`)
  if (!res.ok) throw new Error(`sitemap.xml -> ${res.status} ${res.statusText}`)
  const xml = await res.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim())
}

function metaRobots(html) {
  // Next renders <meta name="robots" content="..."> only when a page sets it.
  return html.match(/<meta[^>]+name="robots"[^>]*content="([^"]*)"/i)?.[1]
    ?? html.match(/<meta[^>]+content="([^"]*)"[^>]*name="robots"/i)?.[1]
}

function canonical(html) {
  return html.match(/<link[^>]+rel="canonical"[^>]*href="([^"]*)"/i)?.[1]
    ?? html.match(/<link[^>]+href="([^"]*)"[^>]*rel="canonical"/i)?.[1]
}

async function inspect(url) {
  const problems = []
  const res = await fetch(url, { redirect: "manual" })
  if (res.status !== 200) {
    problems.push(`status ${res.status}${res.headers.get("location") ? ` -> ${res.headers.get("location")}` : ""}`)
    return { url, problems }
  }
  const html = await res.text()
  const robots = metaRobots(html)
  if (robots && /\bnoindex\b/i.test(robots)) problems.push(`noindex (${robots})`)
  const href = canonical(html)
  if (!href) problems.push("no canonical")
  else if (href.replace(/\/$/, "") !== url.replace(/\/$/, "")) problems.push(`canonical -> ${href}`)
  return { url, problems }
}

const urls = await sitemapUrls()
const results = []
let cursor = 0
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++]
      try {
        results.push(await inspect(url))
      } catch (error) {
        results.push({ url, problems: [`request failed: ${error.message}`] })
      }
    }
  }),
)

const failed = results.filter((result) => result.problems.length > 0)
console.log(`${base}/sitemap.xml: ${urls.length} URLs, ${urls.length - failed.length} clean, ${failed.length} with problems`)
for (const result of failed.sort((a, b) => a.url.localeCompare(b.url))) {
  console.log(`  ✗ ${result.url}\n      ${result.problems.join("; ")}`)
}
process.exit(failed.length > 0 ? 1 : 0)

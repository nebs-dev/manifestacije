#!/usr/bin/env node
/**
 * Smoke test for the core ingestion flow.
 * Uses a local HTML fixture — no live external requests.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=secret pnpm smoke:ingestion
 *
 * Requires the API (port 3001) to be running.
 */

const API = process.env.API_URL ?? "http://localhost:3001/api"
const EMAIL = process.env.ADMIN_EMAIL
const PASSWORD = process.env.ADMIN_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.")
  process.exit(1)
}

// ── Fixture: minimal Croatian event listing HTML ──────────────────────────────
const FIXTURE_HTML = `
<html><body>
<h1>Kulturni program Osijek – srpanj 2025.</h1>

<article class="event">
  <h2>Ljetni jazz festival</h2>
  <p class="date">Petak, 11. srpnja 2025. u 20:00</p>
  <p class="venue">Gradski park, Osijek</p>
  <p class="desc">Večer jazza pod zvijezdama. Nastupaju domaći i inozemni glazbenici.</p>
  <p class="price">Ulaz slobodan</p>
  <a href="https://example-osijek.hr/jazz">Više info</a>
</article>

<article class="event">
  <h2>Radionica keramike za djecu</h2>
  <p class="date">Subota, 12. srpnja 2025. u 10:00</p>
  <p class="venue">Kulturni centar, Osijek</p>
  <p class="desc">Kreativna radionica za djecu od 6 do 12 godina.</p>
  <p class="price">Cijena: 10 EUR</p>
  <a href="https://example-osijek.hr/keramika">Više info</a>
</article>

<article class="event">
  <h2>Noć muzeja</h2>
  <p class="date">Nedjelja, 20. srpnja 2025. u 18:00</p>
  <p class="venue">Muzej Slavonije, Osijek</p>
  <p class="desc">Besplatni ulaz u sve muzeje grada od 18 do 24 sata.</p>
  <p class="price">Besplatan ulaz</p>
  <a href="https://example-osijek.hr/noc-muzeja">Više info</a>
</article>
</body></html>
`

// ── Helpers ───────────────────────────────────────────────────────────────────

let token = null
let step = 0

function pass(msg) { console.log(`  ✓ [${++step}] ${msg}`) }
function fail(msg, detail) {
  console.error(`  ✗ [${++step}] ${msg}`)
  if (detail) console.error("    ", detail)
  process.exit(1)
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })
  return res
}

// ── Steps ─────────────────────────────────────────────────────────────────────

console.log("\nIngestion smoke test\n")

// 1. Login
const loginRes = await api("POST", "/auth/login", { email: EMAIL, password: PASSWORD })
if (!loginRes.ok) fail("Admin login failed", await loginRes.text())
const loginData = await loginRes.json()
token = loginData.access_token ?? loginData.token ?? loginData.accessToken
if (!token) fail("Login response missing token", JSON.stringify(loginData))
pass("Admin login OK")

// 2. Submit fixture via manual-email (no live URL fetch)
const sourceRes = await api("POST", "/admin/event-sources/manual-email", {
  rawEmailSubject: "Kulturni program Osijek – srpanj 2025.",
  rawEmailFrom: "smoke-test@fixture.local",
  rawText: FIXTURE_HTML,
  sourceUrl: "https://fixture.local/osijek-events",
})
if (!sourceRes.ok) fail("POST /admin/event-sources/manual-email failed", await sourceRes.text())
const source = await sourceRes.json()
const sourceId = source.id
if (!sourceId) fail("EventSource missing id", JSON.stringify(source))
pass(`EventSource created (id=${sourceId})`)

// 3. Source has parsedJson
const getRes = await api("GET", `/admin/event-sources/${sourceId}`)
if (!getRes.ok) fail("GET /admin/event-sources/:id failed", await getRes.text())
const sourceDetail = await getRes.json()
const parsedJson = sourceDetail.parsedJson
if (!parsedJson) fail("EventSource.parsedJson is null — parse did not run")
pass("EventSource.parsedJson populated")

// 4. parsedJson.candidates[] is non-empty
const candidates = parsedJson.candidates ?? []
if (!Array.isArray(candidates) || candidates.length === 0) {
  fail("parsedJson.candidates[] is empty — parser produced no candidates",
    JSON.stringify(parsedJson).slice(0, 300))
}
pass(`parsedJson.candidates: ${candidates.length} candidate(s)`)

// 5. First pending candidate can create an Event
const pendingIdx = candidates.findIndex(c => c._status === "pending" || !c._status)
if (pendingIdx === -1) fail("No pending candidate found to create event from")

const createRes = await api("POST", `/admin/event-sources/${sourceId}/create-event`, {
  candidateIndex: pendingIdx,
})
if (!createRes.ok) fail(`create-event (candidateIndex=${pendingIdx}) failed`, await createRes.text())
const createdEvent = await createRes.json()
const eventId = createdEvent.id
if (!eventId) fail("create-event response missing id", JSON.stringify(createdEvent))
pass(`Event created (id=${eventId}) from candidate[${pendingIdx}]: "${candidates[pendingIdx].title}"`)

// 6. Publish the event
const publishRes = await api("POST", `/admin/events/${eventId}/publish`)
if (!publishRes.ok) fail(`POST /admin/events/${eventId}/publish failed`, await publishRes.text())
pass("Event published")

// 7. Event appears in public feed
const feedRes = await api("GET", "/public/events")
if (!feedRes.ok) fail("GET /public/events failed", await feedRes.text())
const feedData = await feedRes.json()
const feedEvents = Array.isArray(feedData) ? feedData : (feedData.data ?? feedData.events ?? [])
const found = feedEvents.some(e => String(e.id) === String(eventId))
if (!found) fail(`Event id=${eventId} not found in public feed (${feedEvents.length} events returned)`)
pass("Published event appears in public feed")

console.log(`\nAll ${step} checks passed.\n`)

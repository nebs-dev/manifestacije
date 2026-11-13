/**
 * Stand-in for the Anthropic Messages API.
 *
 * The API reaches it without a single line of production code changing:
 * `new Anthropic({ apiKey, ... })` in ai-event-parser.service.ts passes no
 * `baseURL`, and the SDK then falls back to `ANTHROPIC_BASE_URL`
 * (node_modules/@anthropic-ai/sdk/client.js:68). The E2E config points that
 * variable here, so no real request, token or cost ever leaves the machine.
 *
 * Only this one external provider is faked. Our own API and web app are the
 * real builds.
 *
 * Control plane (tests drive it through AiStub in support/ai-stub.ts):
 *   POST /__control  { mode, candidates?, status? }  set the next reply
 *   POST /__reset                                    back to defaults
 *   GET  /__requests                                 how often it was called
 */
import { createServer } from "node:http";

const PORT = Number(process.env.E2E_AI_STUB_PORT ?? 3302);

const DEFAULTS = {
  /**
   * candidates   — answer with `state.candidates` as fenced JSON
   * http-error   — answer with `state.status` (503 by default), so the API
   *                takes its ServiceUnavailableException path
   * malformed    — answer 200 with prose instead of JSON
   * empty        — answer with an empty candidate list
   */
  mode: "candidates",
  status: 503,
  candidates: [],
};

let state = { ...DEFAULTS };
const requests = [];

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      // The real poster payloads are base64 images; keep memory bounded.
      if (raw.length > 32_000_000) raw = raw.slice(0, 32_000_000);
    });
    req.on("end", () => resolve(raw));
  });

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
};

/**
 * HTML-escapes anything the request supplied before it goes into a fixture
 * page. Every fixture route echoes part of the request back, so each one needs
 * this — one of them did not, and CodeQL caught the reflected-XSS path.
 */
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Fixture slugs are ours to choose, so hold them to a shape with no HTML in it. */
const safeSlug = (value) => String(value).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 120);

const message = (text) => ({
  id: `msg_e2e_${requests.length}`,
  type: "message",
  role: "assistant",
  model: "claude-haiku-4-5",
  content: [{ type: "text", text }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (req.method === "POST" && url.pathname === "/__control") {
    state = { ...state, ...JSON.parse((await readBody(req)) || "{}") };
    return json(res, 200, { ok: true, state: { ...state, candidates: state.candidates.length } });
  }
  if (req.method === "POST" && url.pathname === "/__reset") {
    state = { ...DEFAULTS };
    requests.length = 0;
    return json(res, 200, { ok: true });
  }
  if (req.method === "GET" && url.pathname === "/__requests") {
    return json(res, 200, { count: requests.length, last: requests.at(-1) ?? null });
  }

  /**
   * A stand-in for an organizer's own event page, so the suite can exercise
   * the real "submit a link" path — the API fetches whatever URL is submitted
   * — without reaching the internet. `?text=` carries the page body, which
   * lets a test make the fetched content and the stubbed model reply agree.
   */
  if (req.method === "GET" && url.pathname === "/fixture/source-page") {
    const text = url.searchParams.get("text") ?? "";
    const html = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><title>E2E izvor</title></head><body><main><pre>${escapeHtml(text)}</pre></main></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(html) });
    return res.end(html);
  }

  /**
   * A listing page that links out to per-event detail pages, which
   * `/fixture/source-page` alone cannot be: the monitored-source check only
   * pays for detail fetches when the listing carries sub-links, and the audit
   * needs to count the model calls one such check really makes.
   * `?events=N` controls how many links the listing carries; `?slugs=a,b,c`
   * sets their last path segment, which is what the service's title-to-link
   * matcher compares a candidate title against.
   */
  if (req.method === "GET" && url.pathname === "/fixture/listing-page") {
    const given = (url.searchParams.get("slugs") ?? "").split(",").map((s) => safeSlug(s.trim())).filter(Boolean);
    const count = given.length || Math.max(1, Math.min(Number(url.searchParams.get("events")) || 3, 60));
    const items = Array.from({ length: count }, (_, i) => {
      const slug = given[i] ?? `dogadaj-${i + 1}`;
      const href = `/fixture/event/${encodeURIComponent(slug)}`;
      return `<article><h2><a href="${escapeHtml(href)}">${escapeHtml(slug.replace(/-/g, " "))}</a></h2><p>Opis događaja ${i + 1}.</p></article>`;
    }).join("");
    const html = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><title>E2E listing</title></head><body><main><h1>Kalendar događanja</h1>${items}</main></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(html) });
    return res.end(html);
  }

  /**
   * A long month-calendar listing, shaped like the page the fix was measured
   * on: entries printed oldest day first, each one carrying a teaser, so the
   * page runs well past what one model call is given and its upcoming events
   * sit at the far end. `?past=` and `?upcoming=` are day counts, `?tag=`
   * changes the bytes without changing the programme.
   */
  if (req.method === "GET" && url.pathname === "/fixture/calendar-page") {
    const clamp = (value, max) => Math.max(0, Math.min(Number(value) || 0, max));
    const past = clamp(url.searchParams.get("past") ?? 90, 400);
    const upcoming = clamp(url.searchParams.get("upcoming") ?? 40, 400);
    const tag = escapeHtml((url.searchParams.get("tag") ?? "").slice(0, 40));
    const GENITIVE = ["siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
      "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca"];
    const dayOf = (offset) => new Date(Date.now() + offset * 86_400_000);
    const numeric = (d) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}.`;
    const written = (d) => `${d.getDate()}. ${GENITIVE[d.getMonth()]} ${d.getFullYear()}.`;
    // One long-running event, dated once and repeated under every day exactly
    // as the measured page repeats its permanent exhibition. Every window
    // therefore carries this date, which is what lets a stubbed reply about it
    // be quoted from whichever window the model was handed.
    const running = dayOf(upcoming + 1);
    const day = (offset, index) => {
      const date = dayOf(offset);
      const filler = "Program počinje u dvorani i traje do večeri. ".repeat(6);
      return `<section><h3>${index}.</h3>`
        + `<p>E2E trajna izložba<br>Datum: ${written(running)}<br>Vrijeme: 19:00</p>`
        + `<p>Opis dana ${index}. ${filler}</p>`
        + `<p>Program dana ${index}<br>${numeric(date)} (${written(date)}) u 20:00</p>`
        + `<p>Nastavak opisa ${index}. ${filler}</p></section>`;
    };
    const days = [
      ...Array.from({ length: past }, (_, i) => day(-(past - i), i + 1)),
      ...Array.from({ length: upcoming }, (_, i) => day(i + 1, past + i + 1)),
    ].join("");
    const html = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><title>E2E kalendar</title></head>`
      + `<body><main><h1>Svi događaji — E2E grad</h1>${tag ? `<p>${tag}</p>` : ""}${days}</main></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(html) });
    return res.end(html);
  }

  /** The detail page the listing above links to. */
  if (req.method === "GET" && url.pathname.startsWith("/fixture/event/")) {
    const slug = safeSlug(decodeURIComponent(url.pathname.slice("/fixture/event/".length)));
    const safe = escapeHtml(slug);
    const html = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><title>${safe}</title></head><body><main><h1>${safe}</h1><p>Detalji događaja ${safe}.</p></main></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(html) });
    return res.end(html);
  }

  if (req.method === "POST" && url.pathname === "/v1/messages") {
    const body = await readBody(req);
    let parsed = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      /* record the call anyway */
    }
    const blocks = parsed?.messages?.[0]?.content ?? [];
    const systemBlocks = Array.isArray(parsed.system) ? parsed.system : parsed.system ? [{ text: parsed.system }] : [];
    requests.push({
      at: new Date().toISOString(),
      model: parsed.model,
      maxTokens: parsed.max_tokens,
      // Sizes only, so the audit can report what one call really carries.
      systemChars: systemBlocks.reduce((sum, block) => sum + (block?.text?.length ?? 0), 0),
      systemCached: systemBlocks.some((block) => block?.cache_control),
      userTextChars: blocks.filter((b) => b?.type === "text").reduce((sum, b) => sum + b.text.length, 0),
      // Never store the image bytes, only how many arrived.
      images: blocks.filter((b) => b?.type === "image").length,
      text: blocks
        .filter((b) => b?.type === "text")
        .map((b) => b.text)
        .join("\n")
        .slice(0, 4000),
    });

    if (state.mode === "http-error") {
      return json(res, state.status, { type: "error", error: { type: "api_error", message: "e2e stub failure" } });
    }
    if (state.mode === "malformed") {
      return json(res, 200, message("Nisam uspio pronaći nijedan događaj na ovoj stranici."));
    }
    const candidates = state.mode === "empty" ? [] : state.candidates;
    return json(res, 200, message("```json\n" + JSON.stringify({ candidates }) + "\n```"));
  }

  return json(res, 404, { type: "error", error: { type: "not_found_error", message: url.pathname } });
});

server.listen(PORT, "127.0.0.1", () => {
  // Playwright waits for this port before starting the API.
  console.log(`[ai-stub] listening on http://127.0.0.1:${PORT}`);
});

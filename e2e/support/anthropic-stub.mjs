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
    const escape = (value) => value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    const html = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><title>E2E izvor</title></head><body><main><pre>${escape(text)}</pre></main></body></html>`;
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
    requests.push({
      at: new Date().toISOString(),
      model: parsed.model,
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

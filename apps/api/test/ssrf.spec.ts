import { lookup } from "node:dns/promises";
import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";
import {
  allowedPrivateHosts,
  assertPublicHttpUrl,
  blockedAddressReason,
  safeFetch,
  SsrfBlockedError,
} from "../src/common/ssrf";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));

const mockLookup = lookup as unknown as jest.Mock;
const resolvesTo = (...addresses: string[]) =>
  mockLookup.mockResolvedValue(addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.SSRF_ALLOW_PRIVATE_HOSTS;
  process.env.NODE_ENV = "test";
});

afterAll(() => {
  process.env = originalEnv;
});

describe("blockedAddressReason", () => {
  /**
   * Each of these reaches a destination the server must never fetch on a
   * user's behalf. The IPv4-in-IPv6 spellings are the ones that used to pass:
   * the previous check only compared the string against "::1", "fe80:" and
   * "fc"/"fd", so ::ffff:127.0.0.1 and ::ffff:169.254.169.254 went through.
   */
  it.each([
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback"],
    ["10.1.2.3", "private"],
    ["172.16.0.1", "private"],
    ["172.31.255.255", "private"],
    ["192.168.1.1", "private"],
    ["169.254.169.254", "cloud metadata"],
    ["0.0.0.0", "this network"],
    ["100.64.0.1", "carrier-grade NAT"],
    ["100.127.255.255", "carrier-grade NAT"],
    ["192.0.0.1", "IETF protocol assignments"],
    ["198.18.0.1", "benchmarking"],
    ["198.19.255.255", "benchmarking"],
    ["224.0.0.1", "multicast"],
    ["255.255.255.255", "multicast or reserved"],
    ["::1", "loopback"],
    ["::", "unspecified"],
    ["fe80::1", "link-local"],
    ["febf::1", "link-local"],
    ["fc00::1", "unique local"],
    ["fd12:3456::1", "unique local"],
    ["ff02::1", "multicast"],
    ["::ffff:127.0.0.1", "loopback"],
    ["::ffff:169.254.169.254", "cloud metadata"],
    ["::ffff:7f00:1", "loopback"],
    ["0:0:0:0:0:ffff:7f00:1", "loopback"],
    ["::127.0.0.1", "loopback"],
    ["2002:7f00:0001::", "loopback"],
    ["2002:a9fe:a9fe::", "cloud metadata"],
    ["64:ff9b::7f00:1", "loopback"],
    ["64:ff9b::a9fe:a9fe", "cloud metadata"],
  ])("blocks %s (%s)", (address, expected) => {
    expect(blockedAddressReason(address)).toContain(expected);
  });

  it.each([["8.8.8.8"], ["1.1.1.1"], ["93.184.216.34"], ["2606:2800:220:1:248:1893:25c8:1946"], ["2a00:1450:4001::1"]])(
    "allows the public address %s",
    (address) => {
      expect(blockedAddressReason(address)).toBeNull();
    }
  );

  it("fails closed on anything it cannot parse as an address", () => {
    expect(blockedAddressReason("not-an-address")).toBe("unrecognised address");
    expect(blockedAddressReason("")).toBe("unrecognised address");
  });
});

describe("assertPublicHttpUrl", () => {
  it("rejects every scheme but http and https", async () => {
    for (const url of ["file:///etc/passwd", "gopher://x/", "ftp://example.com/", "javascript:alert(1)"]) {
      expect(await assertPublicHttpUrl(url)).toMatchObject({ ok: false });
    }
    expect(mockLookup).not.toHaveBeenCalled();
  });

  /**
   * WHATWG URL parsing folds these into 127.0.0.1 before the check sees them,
   * which is why no separate decoding step is needed — this pins that.
   */
  it.each([
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://017700000001/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::1]/",
  ])("rejects the shorthand literal %s without a DNS lookup", async (url) => {
    const verdict = await assertPublicHttpUrl(url);
    expect(verdict.ok).toBe(false);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it.each(["http://localhost/", "http://api.localhost/", "http://printer.local/"])(
    "rejects %s before resolving it",
    async (url) => {
      expect(await assertPublicHttpUrl(url)).toMatchObject({ ok: false });
      expect(mockLookup).not.toHaveBeenCalled();
    }
  );

  it("rejects a hostname that resolves to a private address", async () => {
    resolvesTo("169.254.169.254");
    const verdict = await assertPublicHttpUrl("http://metadata.example.test/latest/meta-data/");
    expect(verdict).toMatchObject({ ok: false });
    expect((verdict as { reason: string }).reason).toContain("169.254.169.254");
  });

  /**
   * A hostname may publish several records. Checking only the first leaves the
   * rest unchecked while the connection is free to use any of them, so every
   * address has to pass.
   */
  it("rejects when any one of several records is private", async () => {
    resolvesTo("93.184.216.34", "10.0.0.5");
    expect(await assertPublicHttpUrl("http://split-horizon.example.test/")).toMatchObject({ ok: false });
    expect(mockLookup).toHaveBeenCalledWith("split-horizon.example.test", { all: true });
  });

  it("allows a hostname whose records are all public", async () => {
    resolvesTo("93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946");
    expect(await assertPublicHttpUrl("https://example.test/program")).toEqual({ ok: true });
  });

  it("rejects a hostname that does not resolve", async () => {
    mockLookup.mockRejectedValue(new Error("ENOTFOUND"));
    expect(await assertPublicHttpUrl("https://nope.example.test/")).toMatchObject({ ok: false });
  });
});

describe("the development allowlist", () => {
  it("lets an explicitly listed private host through", async () => {
    process.env.SSRF_ALLOW_PRIVATE_HOSTS = "127.0.0.1";
    expect(await assertPublicHttpUrl("http://127.0.0.1:3302/fixture/source-page")).toEqual({ ok: true });
  });

  it("does not let an unlisted private host through", async () => {
    process.env.SSRF_ALLOW_PRIVATE_HOSTS = "127.0.0.1";
    expect(await assertPublicHttpUrl("http://169.254.169.254/")).toMatchObject({ ok: false });
  });

  it("does not cover another spelling of an allowlisted address", async () => {
    // The list is matched on the hostname as written. ::ffff:127.0.0.1 reaches
    // the same place as 127.0.0.1 and is not the same string, so it stays out.
    process.env.SSRF_ALLOW_PRIVATE_HOSTS = "127.0.0.1";
    expect(await assertPublicHttpUrl("http://[::ffff:127.0.0.1]:3302/")).toMatchObject({ ok: false });
  });

  /**
   * Fail closed. The runtime has to state that it is development or test;
   * "not production" is not enough, because an unset NODE_ENV or an
   * environment named something else would silently honour the list.
   */
  it.each([[undefined], ["production"], ["staging"], ["prod"], [""]])(
    "refuses to be honoured when NODE_ENV is %s",
    (value) => {
      process.env.SSRF_ALLOW_PRIVATE_HOSTS = "127.0.0.1";
      if (value === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = value;
      expect(() => allowedPrivateHosts()).toThrow(/only honoured when NODE_ENV/);
    }
  );

  it.each([["development"], ["test"]])("is honoured when NODE_ENV is %s", (value) => {
    process.env.SSRF_ALLOW_PRIVATE_HOSTS = "127.0.0.1";
    process.env.NODE_ENV = value;
    expect(allowedPrivateHosts().has("127.0.0.1")).toBe(true);
  });

  // Belt and braces: a deployment that also claims to be a test runtime.
  it.each([
    ["VERCEL_ENV", "production"],
    ["RAILWAY_ENVIRONMENT", "production"],
    ["RAILWAY_ENVIRONMENT_NAME", "production"],
  ])("refuses when %s says production even with NODE_ENV=test", (key, value) => {
    process.env.SSRF_ALLOW_PRIVATE_HOSTS = "127.0.0.1";
    process.env.NODE_ENV = "test";
    process.env[key] = value;
    expect(() => allowedPrivateHosts()).toThrow(/must not be set in production/);
  });

  it("is inert, and throws nothing, when unset", () => {
    delete process.env.NODE_ENV;
    process.env.VERCEL_ENV = "production";
    expect(allowedPrivateHosts().size).toBe(0);
  });
});

describe("safeFetch", () => {
  const response = (status: number, headers: Record<string, string> = {}) =>
    new Response(status >= 300 && status < 400 ? null : "<html>ok</html>", { status, headers });

  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it("fetches a public URL and never follows redirects automatically", async () => {
    resolvesTo("93.184.216.34");
    (global.fetch as jest.Mock).mockResolvedValue(response(200));

    const result = await safeFetch("https://example.test/program");
    expect(result.status).toBe(200);
    expect((global.fetch as jest.Mock).mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  /**
   * The bypass a first-hop-only check cannot see: a public URL that answers
   * 302 with an internal Location. The old `redirect: "follow"` made the
   * guard cosmetic.
   */
  it("blocks a redirect from a public URL to an internal address", async () => {
    mockLookup.mockImplementation(async (hostname: string) =>
      hostname === "example.test"
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "169.254.169.254", family: 4 }]
    );
    (global.fetch as jest.Mock).mockResolvedValueOnce(response(302, { location: "http://metadata.example.test/" }));

    await expect(safeFetch("https://example.test/program")).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("blocks a redirect to a literal internal address", async () => {
    resolvesTo("93.184.216.34");
    (global.fetch as jest.Mock).mockResolvedValueOnce(response(301, { location: "http://[::ffff:169.254.169.254]/" }));
    await expect(safeFetch("https://example.test/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("follows a public redirect chain and returns the final response", async () => {
    resolvesTo("93.184.216.34");
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(response(302, { location: "https://example.test/b" }))
      .mockResolvedValueOnce(response(302, { location: "https://example.test/c" }))
      .mockResolvedValueOnce(response(200));

    expect((await safeFetch("https://example.test/a")).status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("gives up rather than looping on an endless redirect", async () => {
    resolvesTo("93.184.216.34");
    (global.fetch as jest.Mock).mockResolvedValue(response(302, { location: "https://example.test/loop" }));
    await expect(safeFetch("https://example.test/loop")).rejects.toThrow(/Too many redirects/);
  });

  it("refuses the initial URL before making any request", async () => {
    await expect(safeFetch("http://169.254.169.254/latest/meta-data/")).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  /**
   * Every caller goes straight to .text() or .arrayBuffer(), so without a cap
   * the body is whatever the far end decides to send.
   */
  it("refuses a body larger than the cap", async () => {
    resolvesTo("93.184.216.34");
    const big = new Response("x".repeat(5000), { status: 200 });
    (global.fetch as jest.Mock).mockResolvedValue(big);
    await expect(safeFetch("https://example.test/", { maxBytes: 1000 })).rejects.toThrow(/exceeded 1000 bytes/);
  });

  it("returns a body at the cap unchanged and still readable", async () => {
    resolvesTo("93.184.216.34");
    (global.fetch as jest.Mock).mockResolvedValue(new Response("<html>short</html>", { status: 200 }));
    const result = await safeFetch("https://example.test/", { maxBytes: 1000 });
    expect(await result.text()).toBe("<html>short</html>");
    expect(result.status).toBe(200);
  });

  it("leaves a bodiless response alone", async () => {
    resolvesTo("93.184.216.34");
    (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 304 }));
    expect((await safeFetch("https://example.test/")).status).toBe(304);
  });

  /**
   * The timeout is a budget for the whole call. Per-request timeouts would let
   * a chain of slow redirects add up to five times the caller's limit.
   */
  it("gives up when the budget runs out mid-chain", async () => {
    resolvesTo("93.184.216.34");
    (global.fetch as jest.Mock).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return new Response(null, { status: 302, headers: { location: "https://example.test/next" } });
    });
    await expect(safeFetch("https://example.test/a", { timeoutMs: 60 })).rejects.toThrow(/Timed out|aborted|signal/i);
  });

  /**
   * No caller sends credentials today. This keeps a redirect from turning one
   * into a leak the first time somebody does.
   */
  it("drops credentials when a redirect leaves the origin", async () => {
    resolvesTo("93.184.216.34");
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://other.test/x" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await safeFetch("https://example.test/a", {
      headers: { Authorization: "Bearer secret-token", Cookie: "session=abc", "User-Agent": "bot" },
    });

    const second = new Headers((global.fetch as jest.Mock).mock.calls[1][1].headers);
    expect(second.get("authorization")).toBeNull();
    expect(second.get("cookie")).toBeNull();
    expect(second.get("user-agent")).toBe("bot");
  });

  it("keeps them on a same-origin redirect", async () => {
    resolvesTo("93.184.216.34");
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://example.test/b" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await safeFetch("https://example.test/a", { headers: { Authorization: "Bearer keep-me" } });
    const second = new Headers((global.fetch as jest.Mock).mock.calls[1][1].headers);
    expect(second.get("authorization")).toBe("Bearer keep-me");
  });
});

/**
 * The exfiltration path, end to end at the unit level. crawlListingSubPages
 * follows links out of a page the submitter controls and stores 2000
 * characters of each one in rawText, which GET /api/organizer/sources returns
 * to that same submitter. Internal sub-links must therefore be dropped.
 */
describe("crawlListingSubPages", () => {
  const listing = (hrefs: string[]) =>
    `<html><body>${hrefs.map((href, i) => `<a href="${href}">Dogadaj ${i + 1}</a>`).join("")}</body></html>`;

  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it("does not return text from sub-links pointing at internal addresses", async () => {
    const parser = new AiEventParserService();
    mockLookup.mockImplementation(async (hostname: string) =>
      hostname === "evil.example.test"
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }]
    );
    (global.fetch as jest.Mock).mockResolvedValue(new Response("SECRET-INTERNAL-BODY", { status: 200 }));

    const html = listing([
      "http://internal.example.test/a",
      "http://internal.example.test/b",
      "http://internal.example.test/c",
      "http://internal.example.test/d",
    ]);
    const result = await parser.crawlListingSubPages(html, "https://evil.example.test/listing");

    expect(result.subTexts.join("\n")).not.toContain("SECRET-INTERNAL-BODY");
    expect(result.fetched).toBe(0);
  });
});

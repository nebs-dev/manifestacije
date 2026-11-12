import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { lookup } from "node:dns/promises";
import { safeFetch } from "../src/common/ssrf";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));

/**
 * Proof that the connection goes to an address the guard approved, rather than
 * to whatever a second DNS resolution returns.
 *
 * Real sockets and a real local server, because the whole point is what the
 * transport does — a mocked fetch could not show it. The resolver is the only
 * thing faked, and it is made hostile on purpose: it answers with a public
 * address the first time (so the check passes) and a loopback address every
 * time after (what a rebinding attack does).
 */
describe("safeFetch pins the connection to a validated address", () => {
  let server: Server;
  let port: number;
  const lookupSpy = lookup as unknown as jest.Mock;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("LOCAL-SERVER-BODY");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    // closeAllConnections first: keep-alive sockets otherwise hold the server
    // open and the runner reports "Jest did not exit", which in CI is a job
    // that hangs to its timeout.
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => lookupSpy.mockReset());

  it("does not follow a resolver that changes its answer after the check", async () => {
    // First answer: public, so the guard approves. Every later answer:
    // loopback, which is where the socket would go if the name were resolved
    // again at connection time.
    lookupSpy
      .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

    // 93.184.216.34 is not listening for us, so a pinned connection fails to
    // connect. What must never happen is a 200 carrying the local server's
    // body, which is what an unpinned connection would produce.
    await expect(safeFetch(`http://rebind.example.test:${port}/`, { timeoutMs: 4000 })).rejects.toBeDefined();
  }, 15000);

  it("still reaches a host whose single validated address is the real one", async () => {
    lookupSpy.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    process.env.SSRF_ALLOW_PRIVATE_HOSTS = "pinned.example.test";
    process.env.NODE_ENV = "test";
    try {
      const response = await safeFetch(`http://pinned.example.test:${port}/`, { timeoutMs: 4000 });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("LOCAL-SERVER-BODY");
    } finally {
      delete process.env.SSRF_ALLOW_PRIVATE_HOSTS;
    }
  }, 15000);
});

/**
 * Proves the pin is applied per hop and across address families, rather than
 * only on the first request.
 *
 * The two servers listen on 127.0.0.1 and ::1 — different addresses, and
 * different families, both available anywhere. Which one the socket actually
 * reached is then readable from the body that comes back, which is the only
 * way to observe a pin from outside.
 */
describe("the pin is applied to every connection, not just the first", () => {
  const lookupSpy = lookup as unknown as jest.Mock;
  let hop1: Server;
  let hop2: Server;
  let port1: number;
  let port2: number;

  const listen = (server: Server, host: string) =>
    new Promise<number>((resolve) => server.listen(0, host, () => resolve((server.address() as AddressInfo).port)));

  beforeAll(async () => {
    hop2 = createServer((_q, r) => { r.writeHead(200); r.end("HOP2-OVER-IPV6"); });
    port2 = await listen(hop2, "::1");
    hop1 = createServer((_q, r) => { r.writeHead(302, { location: `http://hop2.test:${port2}/` }); r.end(); });
    port1 = await listen(hop1, "127.0.0.1");
  });

  afterAll(async () => {
    for (const s of [hop1, hop2]) {
      if (!s) continue;
      s.closeAllConnections();
      await new Promise<void>((r) => s.close(() => r()));
    }
  });

  beforeEach(() => {
    lookupSpy.mockReset();
    process.env.NODE_ENV = "test";
    process.env.SSRF_ALLOW_PRIVATE_HOSTS = "hop1.test,hop2.test";
  });

  afterEach(() => { delete process.env.SSRF_ALLOW_PRIVATE_HOSTS; });

  it("re-pins on a redirect, including across address families", async () => {
    lookupSpy.mockImplementation(async (hostname: string) =>
      hostname === "hop1.test" ? [{ address: "127.0.0.1", family: 4 }] : [{ address: "::1", family: 6 }]
    );

    const response = await safeFetch(`http://hop1.test:${port1}/`, { timeoutMs: 8000 });
    // Reaching the second server at all means hop two was pinned to its own
    // validated address — a different family from hop one's, so no connection
    // could have been carried over.
    expect(await response.text()).toBe("HOP2-OVER-IPV6");
    expect(lookupSpy.mock.calls.map((c) => c[0])).toEqual(["hop1.test", "hop2.test"]);
  }, 20000);

  it("never consults the resolver again once the guard has validated", async () => {
    // Exactly one lookup, from assertPublicHttpUrl. The connector asks the
    // pinned resolver instead, which answers from memory and never reaches DNS
    // — that is what closes the rebinding window.
    lookupSpy.mockResolvedValue([{ address: "::1", family: 6 }]);
    await safeFetch(`http://hop2.test:${port2}/`, { timeoutMs: 8000 });
    expect(lookupSpy).toHaveBeenCalledTimes(1);
  }, 20000);
});

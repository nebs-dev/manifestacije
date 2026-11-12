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

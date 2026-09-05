import { Logger } from "@nestjs/common";
import { RevalidateService } from "../src/admin/revalidate.service";

describe("revalidation delivery", () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let log: jest.SpyInstance;
  beforeEach(() => {
    process.env.WEB_URL = "https://web.example";
    process.env.REVALIDATE_SECRET = "private-test-secret";
    fetchMock = jest.spyOn(global, "fetch");
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    log = jest.spyOn(Logger.prototype, "log").mockImplementation();
  });
  afterEach(() => { process.env = { ...originalEnv }; jest.restoreAllMocks(); jest.useRealTimers(); });
  const response = (status: number) => ({ ok: status >= 200 && status < 300, status, json: async () => ({ revalidated: true, tag: "events" }) }) as Response;
  it("awaits a 200 acknowledgement", async () => {
    fetchMock.mockResolvedValue(response(200));
    expect(await new RevalidateService().revalidate()).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success", attempt: 1 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([400, 401, 403, 404])("does not retry HTTP %s", async status => {
    fetchMock.mockResolvedValue(response(status));
    expect(await new RevalidateService().revalidate()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ outcome: "http_failure", status }));
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ outcome: "final_failure" }));
  });
  it("retries 500 once then reports failure without throwing", async () => {
    fetchMock.mockResolvedValue(response(500));
    expect(await new RevalidateService().revalidate()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ outcome: "retry", attempt: 2 }));
  });
  it("recovers from transient network failure without logging raw errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error("sensitive upstream error")).mockResolvedValueOnce(response(200));
    expect(await new RevalidateService().revalidate()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive");
  });
  it("aborts timed out requests and finishes after two attempts", async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const result = new RevalidateService().revalidate();
    await jest.advanceTimersByTimeAsync(5000);
    expect(await result).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ outcome: "timeout" }));
  });
  it.each(["WEB_URL", "REVALIDATE_SECRET"])("logs missing %s without secrets", async key => {
    delete process.env[key];
    expect(await new RevalidateService().revalidate()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ outcome: "skipped", missing: [key] }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-test-secret");
  });
  it.each(["bad-url", "ftp://web.example", "https://user:password@web.example", "https://web.example/path"])("rejects invalid origin %s", async url => {
    process.env.WEB_URL = url;
    expect(await new RevalidateService().revalidate()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ reason: "invalid_WEB_URL" }));
  });
  it("rejects an unrelated 200 response", async () => {
    fetchMock.mockResolvedValue({ ...response(200), json: async () => ({}) } as Response);
    expect(await new RevalidateService().revalidate()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

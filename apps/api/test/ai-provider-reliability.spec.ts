import { BadRequestException, Logger, ServiceUnavailableException } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { AiEventParserService } from "../src/ai-parser/ai-event-parser.service";

jest.mock("@anthropic-ai/sdk", () => ({ __esModule: true, default: jest.fn() }));

describe("AI provider failures", () => {
  const originalEnv = process.env;
  let create: jest.Mock;
  let log: jest.SpyInstance;

  beforeEach(() => {
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "synthetic-credential-never-log" };
    create = jest.fn();
    (Anthropic as unknown as jest.Mock).mockImplementation(() => ({ messages: { create } }));
    log = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });
  afterEach(() => { process.env = originalEnv; jest.restoreAllMocks(); jest.clearAllMocks(); });

  it("reports a missing credential as an unavailable service without contacting the provider", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(new AiEventParserService().parseBatchWithLlm({ screenshotBase64: "fixture" }))
      .rejects.toThrow(ServiceUnavailableException);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429, 500, undefined])("sanitizes provider failure %s in responses and logs", async (status) => {
    const secret = process.env.ANTHROPIC_API_KEY!;
    const error = Object.assign(new Error(`request failed with ${secret}`), {
      status, headers: { "x-api-key": secret }, error: { message: secret },
    });
    create.mockRejectedValue(error);
    const result = await new AiEventParserService().parseBatchWithLlm({ rawText: "Privatni sadržaj" }).catch(e => e);
    expect(result).toBeInstanceOf(ServiceUnavailableException);
    expect(result.getStatus()).toBe(503);
    expect(JSON.stringify(result.getResponse())).not.toContain(secret);
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    expect(JSON.stringify(log.mock.calls)).not.toContain("Privatni sadržaj");
    expect(log).toHaveBeenCalledWith(`AI provider request failed (HTTP ${status ?? "unavailable"})`);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([400, 413])("reports unsupported provider input %s without forwarding provider details", async status => {
    create.mockRejectedValue({ status, message: process.env.ANTHROPIC_API_KEY });
    await expect(new AiEventParserService().parseBatchWithLlm({ screenshotBase64: "fixture" }))
      .rejects.toThrow(BadRequestException);
  });
});

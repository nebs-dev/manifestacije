import { Test } from "@nestjs/testing";
import { HealthController } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1, ready: true }]) };
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();
    controller = module.get(HealthController);
  });

  it("returns ok when db is reachable", async () => {
    const result = await controller.health();
    expect(result.ok).toBe(true);
    expect(result.db).toBe("ok");
    expect(result.eventRevisions).toBe("ready");
    expect(typeof result.uptime).toBe("number");
    expect(result.timestamp).toMatch(/^\d{4}-/);
  });

  it("reports an incomplete revision migration", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{}]).mockRejectedValueOnce(new Error("missing table"));
    expect(await controller.health()).toMatchObject({ ok: false, db: "ok", eventRevisions: "unavailable" });
  });

  it("returns ok=false when db is down", async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));
    const result = await controller.health();
    expect(result.ok).toBe(false);
    expect(result.db).toBe("error");
  });
});

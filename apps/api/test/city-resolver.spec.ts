import { findOrCreateCity } from "../src/common/city-resolver";

describe("findOrCreateCity", () => {
  it("reuses an existing canonical city when input only differs by Croatian diacritics", async () => {
    const dakovo = {
      id: 3,
      name: "Đakovo",
      slug: "dakovo",
      countyId: 1,
      county: { id: 1, regionId: 1, region: { slug: "slavonija-i-baranja" } },
    };
    const prisma = {
      city: {
        findFirst: jest.fn().mockResolvedValue(dakovo),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const result = await findOrCreateCity(prisma as never, "Dakovo");

    expect(result).toBe(dakovo);
    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { equals: "Dakovo", mode: "insensitive" } },
          { slug: "dakovo" },
        ],
      },
      include: { county: { include: { region: true } } },
    });
    expect(prisma.city.create).not.toHaveBeenCalled();
  });
});

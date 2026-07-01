import { BadRequestException } from "@nestjs/common";
import { UploadsService } from "../src/admin/uploads.service";

describe("UploadsService", () => {
  const service = new UploadsService();
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it("rejects missing files", () => {
    expect(() => service.validateEventImage(undefined)).toThrow(BadRequestException);
  });

  it("rejects invalid file types", () => {
    expect(() => service.validateEventImage({ buffer: Buffer.from("x"), mimetype: "text/plain", size: 1 })).toThrow(BadRequestException);
  });

  it("rejects oversized files", () => {
    expect(() => service.validateEventImage({ buffer: Buffer.from("x"), mimetype: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).toThrow(BadRequestException);
  });

  it("accepts jpeg, png and webp under 5MB", () => {
    for (const mimetype of ["image/jpeg", "image/png", "image/webp"]) {
      expect(() => service.validateEventImage({ buffer: Buffer.from("x"), mimetype, size: 1024 })).not.toThrow();
    }
  });

  it("rejects upload when Cloudinary config is missing", async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    await expect(service.uploadEventImage({ buffer: Buffer.from("x"), mimetype: "image/jpeg", size: 1024 })).rejects.toThrow("Cloudinary upload is not configured");
  });

  it("surfaces Cloudinary upload failures without exposing secrets", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "key";
    process.env.CLOUDINARY_API_SECRET = "secret";
    jest.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Invalid signature" } }),
    } as never);

    await expect(service.uploadEventImage({ buffer: Buffer.from("x"), mimetype: "image/jpeg", size: 1024 })).rejects.toThrow("Cloudinary upload failed");
    expect(global.fetch).toHaveBeenCalledWith("https://api.cloudinary.com/v1_1/demo/image/upload", expect.objectContaining({ method: "POST" }));
  });
});

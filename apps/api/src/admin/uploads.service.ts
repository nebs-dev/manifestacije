import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash } from "crypto";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export type UploadedEventImage = {
  imageUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
};

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname?: string;
};

@Injectable()
export class UploadsService {
  async uploadEventImage(file?: UploadedFile): Promise<UploadedEventImage> {
    this.validateEventImage(file);
    const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || "manifestacije/events";
    return this.uploadToCloudinary(file!, folder);
  }

  /**
   * Re-hosts a scraped image on our own CDN.
   *
   * Aggregators delete and rotate their storage — an event we imported today
   * can lose its poster next week, and a URL we merely point at is theirs to
   * break. Copying the bytes once, at approval time, is what makes the image
   * ours. Returns null instead of throwing: a failed copy must never block
   * publishing an otherwise good event, it just leaves the original URL.
   */
  async uploadEventImageFromUrl(imageUrl: string): Promise<UploadedEventImage | null> {
    try {
      const response = await fetch(imageUrl, {
        headers: { "User-Agent": "Manifestacije/1.0 event-ingestion-bot (+https://manifestacije.hr)" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) return null;

      const mimetype = (response.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!ALLOWED_IMAGE_TYPES.has(mimetype)) return null;

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_SIZE_BYTES) return null;

      const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || "manifestacije/events";
      return await this.uploadToCloudinary(
        { buffer, mimetype, size: buffer.byteLength, originalname: this.fileNameFromUrl(imageUrl) },
        folder,
      );
    } catch {
      return null;
    }
  }

  private fileNameFromUrl(imageUrl: string): string {
    try {
      return new URL(imageUrl).pathname.split("/").filter(Boolean).pop() || "image";
    } catch {
      return "image";
    }
  }

  async uploadPartnerLogo(file?: UploadedFile): Promise<UploadedEventImage> {
    this.validateEventImage(file);
    const folder = process.env.CLOUDINARY_PARTNER_FOLDER || "manifestacije/partners";
    return this.uploadToCloudinary(file!, folder);
  }

  private async uploadToCloudinary(file: UploadedFile, folder: string): Promise<UploadedEventImage> {
    const { cloudName, apiKey, apiSecret } = this.cloudinaryCredentials();

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign({ folder, timestamp }, apiSecret);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname || "image");
    form.append("api_key", apiKey);
    form.append("timestamp", timestamp);
    form.append("folder", folder);
    form.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) {
      const detail = typeof data.error === "object"
        ? JSON.stringify(data.error)
        : String(data.error || data.message || "unknown");
      console.error("[Cloudinary] upload failed:", JSON.stringify(data));
      throw new BadRequestException(`Cloudinary upload failed: ${detail}`);
    }

    return {
      imageUrl: String(data.secure_url),
      publicId: String(data.public_id),
      width: Number(data.width),
      height: Number(data.height),
      format: String(data.format),
    };
  }

  validateEventImage(file?: UploadedFile): asserts file is UploadedFile {
    if (!file) throw new BadRequestException("Missing file");
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Unsupported image type");
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException("Image is larger than 5MB");
    }
  }

  private cloudinaryCredentials() {
    // Support both CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUD and three separate vars
    const url = process.env.CLOUDINARY_URL;
    if (url) {
      try {
        const parsed = new URL(url);
        return { cloudName: parsed.host, apiKey: parsed.username, apiSecret: parsed.password };
      } catch { /* fall through to separate vars */ }
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException("Cloudinary nije konfiguriran — dodaj CLOUDINARY_URL ili CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET u .env");
    }
    return { cloudName, apiKey, apiSecret };
  }

  private sign(params: Record<string, string>, secret: string) {
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");
    return createHash("sha1").update(`${payload}${secret}`).digest("hex");
  }
}

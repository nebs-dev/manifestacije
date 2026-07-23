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

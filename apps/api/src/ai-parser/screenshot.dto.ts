import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { IsSafeHttpUrl } from "../common/safe-url";

/** ~5 MB of image bytes as base64; the web client resizes to 1600 px first. */
export const MAX_SCREENSHOT_BASE64_LENGTH = 7_000_000;
export const MAX_SCREENSHOTS_PER_REQUEST = 4;

/** One poster/screenshot sent as parsing input (EVT-07/08). */
export class ScreenshotInputDto {
  @IsString()
  @MaxLength(MAX_SCREENSHOT_BASE64_LENGTH, { message: "Slika je prevelika (najviše oko 5 MB)." })
  @Matches(/^[A-Za-z0-9+/]+={0,2}$/, { message: "Slika nije ispravno kodirana." })
  base64!: string;

  @IsIn(["image/jpeg", "image/png", "image/webp", "image/gif"], { message: "Podržane su slike JPEG, PNG, WebP i GIF." })
  mediaType!: string;

  /** Uploaded copy in our image storage, when the upload succeeded. */
  @IsOptional() @IsString() @IsSafeHttpUrl()
  imageUrl?: string;
}

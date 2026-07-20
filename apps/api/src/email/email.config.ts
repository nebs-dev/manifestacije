import type { EmailProviderName } from "./email.types";

export interface EmailConfig {
  deliveryMode: EmailProviderName;
  provider: EmailProviderName;
  resendApiKey?: string;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  adminNotificationEmail: string;
  publicWebUrl: string;
}

/**
 * Reads and validates email env config once at module init. Production requires
 * RESEND_API_KEY, EMAIL_FROM_ADDRESS, and PUBLIC_WEB_URL — failing fast at boot
 * is preferable to silently dropping transactional email in prod.
 */
export function loadEmailConfig(): EmailConfig {
  const deliveryMode = (process.env.EMAIL_DELIVERY_MODE || "log") as EmailProviderName;
  const provider = (process.env.EMAIL_PROVIDER || "resend") as EmailProviderName;
  const fromName = process.env.EMAIL_FROM_NAME || "Manifestacije.hr";
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || "obavijesti@manifestacije.hr";
  const replyTo = process.env.EMAIL_REPLY_TO || "info@manifestacije.hr";
  const adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "info@manifestacije.hr";
  const publicWebUrl = process.env.PUBLIC_WEB_URL || "http://localhost:3000";
  const resendApiKey = process.env.RESEND_API_KEY;

  if (process.env.NODE_ENV === "production" && deliveryMode === "resend") {
    const missing: string[] = [];
    if (!resendApiKey) missing.push("RESEND_API_KEY");
    if (!process.env.EMAIL_FROM_ADDRESS) missing.push("EMAIL_FROM_ADDRESS");
    if (!process.env.PUBLIC_WEB_URL) missing.push("PUBLIC_WEB_URL");
    if (missing.length) {
      throw new Error(`Missing required email env vars in production: ${missing.join(", ")}`);
    }
  }

  return { deliveryMode, provider, resendApiKey, fromName, fromAddress, replyTo, adminNotificationEmail, publicWebUrl };
}

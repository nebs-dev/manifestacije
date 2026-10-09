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
  passwordResetUrl: string;
  passwordResetTokenTtlMinutes: number;
  organizerClaimUrl: string;
  organizerClaimTokenTtlMinutes: number;
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production"
    || process.env.VERCEL_ENV === "production"
    || process.env.RAILWAY_ENVIRONMENT === "production"
    || process.env.RAILWAY_ENVIRONMENT_NAME === "production";
}

/**
 * Reads and validates email env config once at module init. Production requires
 * RESEND_API_KEY, EMAIL_FROM_ADDRESS, and PUBLIC_WEB_URL — failing fast at boot
 * is preferable to silently dropping transactional email in prod.
 */
export function loadEmailConfig(): EmailConfig {
  const productionRuntime = isProductionRuntime();
  const deliveryMode = (process.env.EMAIL_DELIVERY_MODE || (productionRuntime ? "resend" : "log")) as EmailProviderName;
  const provider = (process.env.EMAIL_PROVIDER || "resend") as EmailProviderName;
  const fromName = process.env.EMAIL_FROM_NAME || "Manifestacije.hr";
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || "info@manifestacije.hr";
  const replyTo = process.env.EMAIL_REPLY_TO || "info@manifestacije.hr";
  const adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "info@manifestacije.hr";
  const publicWebUrl = (process.env.PUBLIC_WEB_URL || "http://localhost:3000").replace(/\/$/, "");
  const resendApiKey = process.env.RESEND_API_KEY;
  // Never hardcode a Vercel preview URL — fall back to PUBLIC_WEB_URL, not localhost, in prod.
  const passwordResetUrl = process.env.PASSWORD_RESET_URL || `${publicWebUrl}/reset-password`;
  const passwordResetTokenTtlMinutes = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30);
  const organizerClaimUrl = process.env.ORGANIZER_CLAIM_URL || `${publicWebUrl}/preuzmi-profil`;
  const organizerClaimTokenTtlMinutes = Number(process.env.ORGANIZER_CLAIM_TOKEN_TTL_MINUTES || 30);

  if (productionRuntime && deliveryMode !== "resend") {
    throw new Error("EMAIL_DELIVERY_MODE must be set to resend in production.");
  }

  if (productionRuntime && deliveryMode === "resend") {
    const missing: string[] = [];
    if (!resendApiKey) missing.push("RESEND_API_KEY");
    if (!process.env.EMAIL_FROM_ADDRESS) missing.push("EMAIL_FROM_ADDRESS");
    if (!process.env.PUBLIC_WEB_URL) missing.push("PUBLIC_WEB_URL");
    if (missing.length) {
      throw new Error(`Missing required email env vars in production: ${missing.join(", ")}`);
    }
  }

  if (!["log", "resend"].includes(deliveryMode) || provider !== "resend") throw new Error("Invalid email provider configuration");
  for (const [key, address] of Object.entries({ EMAIL_FROM_ADDRESS: fromAddress, EMAIL_REPLY_TO: replyTo, ADMIN_NOTIFICATION_EMAIL: adminNotificationEmail })) {
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) throw new Error(`Invalid ${key}`);
  }
  if (/[\r\n<>]/.test(fromName)) throw new Error("Invalid EMAIL_FROM_NAME");
  const web = safeUrl(publicWebUrl, productionRuntime, "PUBLIC_WEB_URL");
  if (web.pathname !== "/" || web.search || web.hash) throw new Error("PUBLIC_WEB_URL must be an origin");
  for (const [key, value, path] of [["PASSWORD_RESET_URL", passwordResetUrl, "/reset-password"], ["ORGANIZER_CLAIM_URL", organizerClaimUrl, "/preuzmi-profil"]]) {
    const url = safeUrl(value, productionRuntime, key);
    if (url.origin !== web.origin || url.pathname !== path || url.search || url.hash) throw new Error(`Invalid ${key}: expected canonical web page without query or fragment`);
  }
  for (const [key, value] of [["PASSWORD_RESET_TOKEN_TTL_MINUTES", passwordResetTokenTtlMinutes], ["ORGANIZER_CLAIM_TOKEN_TTL_MINUTES", organizerClaimTokenTtlMinutes]] as const) {
    if (!Number.isInteger(value) || value < 1 || value > 43200) throw new Error(`Invalid ${key}`);
  }
  return { deliveryMode, provider, resendApiKey, fromName, fromAddress, replyTo, adminNotificationEmail, publicWebUrl, passwordResetUrl, passwordResetTokenTtlMinutes, organizerClaimUrl, organizerClaimTokenTtlMinutes };
}

function safeUrl(value: string, production: boolean, key: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Invalid ${key}`); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password
    || (production && (url.protocol !== "https:" || !["manifestacije.hr", "www.manifestacije.hr"].includes(url.hostname) || url.port))) {
    throw new Error(`Invalid ${key}: use the canonical public web origin`);
  }
  return url;
}

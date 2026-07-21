import { renderLayout, renderButton, escapeHtml } from "./email-layout";

export interface OrganizerClaimData {
  organizerName: string;
  claimUrl: string;
  ttlMinutes: number;
  webUrl: string;
}

export function organizerClaimSubject(): string {
  return "Preuzmite profil organizatora na Manifestacije.hr";
}

/** Claim links can be valid for days, not just minutes — "vrijedi 10080 minuta"
 *  reads badly, so render the largest whole unit that fits. */
function formatTtl(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 dan" : `${days} dana`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 sat" : `${hours} sati`;
  }
  return `${minutes} minuta`;
}

export function organizerClaimHtml(data: OrganizerClaimData): string {
  const body = `
    <p style="margin:0 0 16px;">Pozdrav,</p>
    <p style="margin:0 0 16px;">Zatraženo je preuzimanje profila organizatora <strong>${escapeHtml(data.organizerName)}</strong> na Manifestacije.hr.</p>
    ${renderButton("Preuzmi profil", data.claimUrl)}
    <p style="margin:16px 0 0;">Poveznica vrijedi ${escapeHtml(formatTtl(data.ttlMinutes))}.</p>
    <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Ako niste poslali ovaj zahtjev, zanemarite poruku.</p>
  `;
  return renderLayout({ preheader: "Zatraženo je preuzimanje profila organizatora.", bodyHtml: body, webUrl: data.webUrl });
}

export function organizerClaimText(data: OrganizerClaimData): string {
  return [
    `Zatraženo je preuzimanje profila organizatora ${data.organizerName} na Manifestacije.hr.`,
    "",
    `Preuzmi profil: ${data.claimUrl}`,
    "",
    `Poveznica vrijedi ${formatTtl(data.ttlMinutes)}.`,
    "",
    "Ako niste poslali ovaj zahtjev, zanemarite poruku.",
  ].join("\n");
}

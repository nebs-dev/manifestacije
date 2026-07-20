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

export function organizerClaimHtml(data: OrganizerClaimData): string {
  const body = `
    <p style="margin:0 0 16px;">Pozdrav,</p>
    <p style="margin:0 0 16px;">Zatraženo je preuzimanje profila organizatora <strong>${escapeHtml(data.organizerName)}</strong> na Manifestacije.hr.</p>
    ${renderButton("Preuzmi profil", data.claimUrl)}
    <p style="margin:16px 0 0;">Poveznica vrijedi ${escapeHtml(String(data.ttlMinutes))} minuta.</p>
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
    `Poveznica vrijedi ${data.ttlMinutes} minuta.`,
    "",
    "Ako niste poslali ovaj zahtjev, zanemarite poruku.",
  ].join("\n");
}

import { renderLayout, renderButton, escapeHtml } from "./email-layout";

export interface PasswordResetData {
  resetUrl: string;
  ttlMinutes: number;
  webUrl: string;
}

export function passwordResetSubject(): string {
  return "Promijenite lozinku za Manifestacije.hr";
}

export function passwordResetHtml(data: PasswordResetData): string {
  const body = `
    <p style="margin:0 0 16px;">Pozdrav,</p>
    <p style="margin:0 0 16px;">Zatražena je promjena lozinke za vaš račun na Manifestacije.hr.</p>
    ${renderButton("Postavi novu lozinku", data.resetUrl)}
    <p style="margin:16px 0 0;">Poveznica vrijedi ${escapeHtml(String(data.ttlMinutes))} minuta.</p>
    <p style="margin:8px 0 0;color:#6b7280;font-size:13px;">Ako niste zatražili promjenu lozinke, zanemarite ovu poruku.</p>
  `;
  return renderLayout({ preheader: "Zatražena je promjena lozinke.", bodyHtml: body, webUrl: data.webUrl });
}

export function passwordResetText(data: PasswordResetData): string {
  return [
    "Zatražena je promjena lozinke za vaš račun na Manifestacije.hr.",
    "",
    `Postavi novu lozinku: ${data.resetUrl}`,
    "",
    `Poveznica vrijedi ${data.ttlMinutes} minuta.`,
    "",
    "Ako niste zatražili promjenu lozinke, zanemarite ovu poruku.",
  ].join("\n");
}

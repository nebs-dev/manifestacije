import { renderLayout, renderButton, escapeHtml } from "./email-layout";

export interface OrganizerWelcomeData {
  organizerName: string;
  webUrl: string;
}

export function organizerWelcomeSubject(): string {
  return "Dobro došli na Manifestacije.hr";
}

export function organizerWelcomeHtml(data: OrganizerWelcomeData): string {
  const submitUrl = `${data.webUrl}/organizer/events/new`;
  const body = `
    <p style="margin:0 0 16px;">Pozdrav ${escapeHtml(data.organizerName)},</p>
    <p style="margin:0 0 16px;">Dobro došli na Manifestacije.hr! Vaš organizatorski račun je uspješno kreiran.</p>
    <p style="margin:0 0 16px;">Sada možete dodavati svoje događaje — ručno ili slanjem poveznice na postojeću objavu — i pratiti njihov status u svom organizatorskom području.</p>
    ${renderButton("Dodaj događaj", submitUrl)}
    <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">Imate pitanje? Odgovorite izravno na ovaj e-mail ili nam pišite na info@manifestacije.hr.</p>
  `;
  return renderLayout({ preheader: "Vaš organizatorski račun je spreman.", bodyHtml: body, webUrl: data.webUrl });
}

export function organizerWelcomeText(data: OrganizerWelcomeData): string {
  const submitUrl = `${data.webUrl}/organizer/events/new`;
  return [
    `Pozdrav ${data.organizerName},`,
    "",
    "Dobro došli na Manifestacije.hr! Vaš organizatorski račun je uspješno kreiran.",
    "Sada možete dodavati svoje događaje i pratiti njihov status u organizatorskom području.",
    "",
    `Dodaj događaj: ${submitUrl}`,
    "",
    "Pitanja: info@manifestacije.hr",
  ].join("\n");
}

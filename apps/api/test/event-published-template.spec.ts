import { eventPublishedHtml, eventPublishedSubject, eventPublishedText, eventShareLinks } from "../src/email/templates/event-published.template";

describe("event published email (NOT-03)", () => {
  const data = {
    eventTitle: `Koncert "Tamburaši" & <prijatelji>`,
    eventDateLabel: "subota, 14. studenoga 2026.",
    eventLocationLabel: "Osijek",
    publicEventUrl: "https://manifestacije.hr/eventi/koncert-tamburasi",
    webUrl: "https://manifestacije.hr",
  };

  it("builds URL-encoded Facebook and WhatsApp share links", () => {
    const links = eventShareLinks(data);
    expect(links.facebook).toBe("https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fmanifestacije.hr%2Feventi%2Fkoncert-tamburasi");
    expect(links.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(links.whatsapp.slice("https://wa.me/?text=".length))).toBe(`${data.eventTitle} — ${data.publicEventUrl}`);
    expect(links.whatsapp).not.toMatch(/[<>"& ]/);
  });

  it("renders a Croatian confirmation with the public link and share prompt, escaping the title", () => {
    const html = eventPublishedHtml(data);
    expect(eventPublishedSubject(data)).toBe(`Vaš događaj je objavljen: ${data.eventTitle}`);
    expect(html).toContain("Koncert &quot;Tamburaši&quot; &amp; &lt;prijatelji&gt;");
    expect(html).not.toContain("<prijatelji>");
    expect(html).toContain('href="https://manifestacije.hr/eventi/koncert-tamburasi"');
    expect(html).toContain("Podijelite događaj");
    expect(html).toContain("Podijeli na Facebooku");
    expect(html).toContain("Pošalji na WhatsApp");
    expect(html).toContain(`href="${eventShareLinks(data).facebook}"`);
    expect(html).toContain(`href="${eventShareLinks(data).whatsapp}"`);
    expect(html).toContain('<html lang="hr">');
  });

  it("has a plain-text fallback with the public URL and both share links", () => {
    const text = eventPublishedText(data);
    expect(text).toContain(`Objava: ${data.publicEventUrl}`);
    expect(text).toContain(`Facebook: ${eventShareLinks(data).facebook}`);
    expect(text).toContain(`WhatsApp: ${eventShareLinks(data).whatsapp}`);
    expect(text).not.toMatch(/<(p|a|div|table|strong|br)\b/i);
  });
});

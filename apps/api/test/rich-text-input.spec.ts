import { plainToInstance } from "class-transformer";
import { sanitizeDescriptionInput } from "../src/common/rich-text";
import { EventContentDto } from "../src/events/event.dto";

describe("event description input sanitizing (EVT-03)", () => {
  it("keeps the Markdown subset and plain text untouched", () => {
    const text = "**Program**\n\n- *Ulaz* besplatan\n- [Ulaznice](https://example.hr/a?b=1&c=2)\n\nVolimo te <3, a < b";
    expect(sanitizeDescriptionInput(text)).toBe(text);
  });

  it("drops scripts, iframes, styles and event handlers, and strips every other tag", () => {
    const dirty = `Uvod<script>alert(1)</script><iframe src="https://evil.example"></iframe><style>p{}</style>
<p onclick="x()">Prvi <b>odlomak</b></p><img src=x onerror=alert(1)><a href="javascript:alert(1)">klik</a><svg><script>1</script></svg>`;
    const clean = sanitizeDescriptionInput(dirty) as string;
    expect(clean).not.toMatch(/<|script|iframe|onerror|onclick|javascript|alert/i);
    expect(clean).toContain("Prvi odlomak");
    expect(clean).toContain("klik");
  });

  it("turns pasted line-breaking HTML into newlines and normalizes Windows line endings", () => {
    expect(sanitizeDescriptionInput("Red 1<br>Red 2</p><p>Odlomak\r\n\r\n\r\n\r\nKraj")).toBe("Red 1\nRed 2\nOdlomak\n\nKraj");
  });

  it("is applied when request bodies are transformed", () => {
    const dto = plainToInstance(EventContentDto, { description: "Opis<script>alert(1)</script> **jak**" });
    expect(dto.description).toBe("Opis **jak**");
  });
});

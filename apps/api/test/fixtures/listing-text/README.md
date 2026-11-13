# Listing-page text fixtures

Extracted text (`AiEventParserService.textForFingerprint`) of the two long
listing pages named in the sources audit, captured **2026-11-13**. They are
here because the window selection in `listing-windows.ts` only matters on real
pages: both are far past one model call's budget, and they fail in opposite
directions, which is exactly what a synthetic fixture would not reproduce.

| file | page | text | shape |
| --- | --- | --- | --- |
| `kulturni-centar-sva-dogadjanja.txt.gz` | kulturni-centar.hr/dogadjanja/sva-dogadjanja | 91 796 chars | archive, newest first — every upcoming date is in the first 3 237 chars |
| `osijek031-svi-dogadaji.txt.gz` | osijek031.com/svi-dogadaji/ | 69 634 chars | month calendar, day 1 upward — on the 13th every upcoming date sat beyond char 39 443 |

Stored gzipped (38 KB for both) and as text rather than HTML, because the text
is what the selection reads and the HTML is 135 KB compressed.

The dates in them are fixed in the past relative to any later test run, so
tests pin "today" explicitly instead of using the clock.
